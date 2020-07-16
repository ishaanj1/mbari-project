import os
import json
import datetime
import copy

import pandas as pd
import numpy as np
import boto3
from psycopg2 import connect

from predict import predict
from config import config
from utils.query import pd_query, get_db_connection, get_s3_connection


def vectorized_iou(list_bboxes1, list_bboxes2):
    x11, y11, x12, y12 = np.split(list_bboxes1, 4, axis=1)
    x21, y21, x22, y22 = np.split(list_bboxes2, 4, axis=1)

    xA = np.maximum(x11, x21)
    yA = np.maximum(y11, y21)
    xB = np.minimum(x12, x22)
    yB = np.minimum(y12, y22)
    interArea = np.maximum((xB - xA), 0) * np.maximum((yB - yA), 0)
    boxAArea = np.abs((x12 - x11) * (y12 - y11))
    boxBArea = np.abs((x22 - x21) * (y22 - y21))
    denominator = (boxAArea + boxBArea - interArea)
    ious = np.where(denominator != 0, interArea / denominator, 0)
    return [iou[0] for iou in ious]


def convert_hierarchy_counts(value_counts, collections):
    # normal counts is a count_values type object
    # It ignores hierarchy counts
    normal_counts = copy.deepcopy(value_counts)
    for collectionid, count in value_counts[value_counts.index < 0].iteritems():
        del value_counts[collectionid]
        del normal_counts[collectionid]
        collection_conceptids = collections[collectionid]
        for conceptid in collection_conceptids:
            value_counts[conceptid] += count / len(collection_conceptids)
    return value_counts, normal_counts


def get_count(count_values, concept):
    return count_values[concept] if concept in count_values.index else 0


def get_precision(TP, FP):
    return TP / (TP + FP) if (TP + FP) != 0 else 0


def get_recall(TP, FN):
    return TP / (TP + FN) if (TP + FN) != 0 else 0


def get_f1(recall, precision):
    return (2 * recall * precision / (precision + recall)) if (precision + recall) != 0 else 0


def count_accuracy(true_num, pred_num):
    if true_num == 0:
        return 1.0 if pred_num == 0 else 0
    else:
        return 1 - (abs(true_num - pred_num) / max(true_num, pred_num))


def get_recall_precision_f1_counts(TP, FP, FN):
    pred_num, true_num = TP+FP, TP+FN
    r, p = get_recall(TP, FN), get_precision(TP, FP)
    return r, p, get_f1(r, p), pred_num, true_num, count_accuracy(true_num, pred_num)


def generate_metrics(concepts, list_of_classifications):
    metrics = pd.DataFrame()
    for concept in concepts:
        HTP, HFP, HFN, TP, FP, FN = [
            get_count(classification, concept) for classification in list_of_classifications]

        metrics = metrics.append([
            [
                concept,
                HTP, HFP, HFN, *get_recall_precision_f1_counts(HTP, HFP, HFN),
                TP, FP, FN, *get_recall_precision_f1_counts(TP, FP, FN)
            ]
        ])
    metrics.columns = [
        "conceptid",
        "H_TP", "H_FP", "H_FN", "H_Precision", "H_Recall", "H_F1", "H_pred_num", "H_true_num", "H_count_accuracy",
        "TP", "FP", "FN", "Precision", "Recall", "F1", "pred_num", "true_num", "count_accuracy"]
    return metrics


def score_predictions(validation, predictions, iou_thresh, concepts, collections):
    validation['id'] = validation.index
    cords = ['x1', 'y1', 'x2', 'y2']
    val_suffix = '_val'
    pred_suffix = '_pred'

    # Set the index to frame_num for merge on prediction
    merged_user_pred_annotations = validation.set_index('frame_num').join(predictions.set_index(
        'frame_num'), lsuffix=val_suffix, rsuffix=pred_suffix, sort=True).reset_index()
    # Only keep rows which the predicted label matching validation (or collection)
    merged_user_pred_annotations = merged_user_pred_annotations[
        merged_user_pred_annotations.apply(
            lambda row:
            True if
            row.label_val == row.label_pred
            or (row.label_pred < 0 and row.label_val in collections[row.label_pred])
            else False, axis=1)]

    # get data from validation x_val...
    merged_val_x_y = merged_user_pred_annotations[[
        cord+val_suffix for cord in cords]].to_numpy()
    # get data for pred data x_pred...
    merged_pred_x_y = merged_user_pred_annotations[[
        cord+pred_suffix for cord in cords]].to_numpy()

    # Get iou for each row
    iou = vectorized_iou(merged_val_x_y, merged_pred_x_y)
    merged_user_pred_annotations = merged_user_pred_annotations.assign(iou=iou)

    # Correctly Classified must have iou greater than or equal to threshold
    correctly_classified_objects = merged_user_pred_annotations[
        merged_user_pred_annotations.iou >= iou_thresh]
    correctly_classified_objects = correctly_classified_objects.drop_duplicates(
        subset='objectid_pred')

    # True Positive
    HTP = correctly_classified_objects.sort_values(
        by=['label_pred', 'iou'], ascending=False).drop_duplicates(subset='id').label_pred.value_counts()
    HTP, TP = convert_hierarchy_counts(HTP, collections)

    # False Positive
    pred_objects_no_val = predictions[~predictions.objectid.isin(
        correctly_classified_objects.objectid_pred)].drop_duplicates(subset='objectid')
    HFP = pred_objects_no_val['label'].value_counts()
    HFP, FP = convert_hierarchy_counts(HFP, collections)

    # False Negative
    HFN = validation[~validation.id.isin(
        correctly_classified_objects.id)].label.value_counts()
    FN = validation[~validation.id.isin(
        correctly_classified_objects[correctly_classified_objects.label_pred > 0].id)].label.value_counts()

    return generate_metrics(concepts, [HTP, HFP, HFN, TP, FP, FN])


def update_ai_videos_database(model_username, video_id, filename, con=None):
    # Get the model's name
    username_split = model_username.split('-')
    version = username_split[-1]
    model_name = '-'.join(username_split[:-1])

    # add the entry to ai_videos
    cursor = con.cursor()
    cursor.execute('''
            INSERT INTO ai_videos (name, videoid, version, model_name)
            VALUES (%s, %s, %s, %s)''',
                   (filename, video_id, version, model_name)
                   )
    con.commit()


def upload_metrics(metrics, filename, video_id, s3=None):
    metrics.to_csv("metrics" + str(video_id) + ".csv")
    # upload the data to s3 bucket
    print("uploading to s3 folder")
    s3.upload_file(
        "metrics" + str(video_id) + ".csv",
        config.S3_BUCKET,
        config.S3_METRICS_FOLDER + filename.replace("mp4", "csv"),
        ExtraArgs={"ContentType": "application/vnd.ms-excel"},
    )
    print(metrics)


def evaluate(video_id, model_username, concepts, upload_annotations=False,
             user_id=None, create_collection=False, collections=None):
    con = get_db_connection()
    s3 = get_s3_connection()

    collection_id = create_annotation_collection(
        model_username, user_id, video_id, concepts, upload_annotations, con=con) if create_collection else None

    # filename format: (video_id)_(model_name)-(version).mp4
    # This the generated video's filename
    filename = str(video_id) + "_" + model_username + ".mp4"
    print("ai video filename: {0}".format(filename))

    results, annotations = predict.predict_on_video(
        video_id, config.WEIGHTS_PATH, concepts, filename, upload_annotations,
        user_id, collection_id, collections, con=con, s3=s3)
    if (results.empty):  # If the model predicts nothing stop here
        return
    # Send the new generated video to our database
    update_ai_videos_database(model_username, video_id, filename, con=con)
    print("done predicting")

    # This scores our well our model preformed against user annotations
    metrics = score_predictions(
        annotations, results, config.EVALUATION_IOU_THRESH, concepts, collections
    )
    # Upload metrics to s3 bucket
    upload_metrics(metrics, filename, video_id, s3=s3)

    con.close()


def create_annotation_collection(model_name, user_id, video_id, concept_ids, upload_annotations, con=con):
    if not upload_annotations:
        raise ValueError("cannot create new annotation collection if "
                         "annotations aren't uploaded")
    if user_id is None:
        raise ValueError("user_id is None, cannot create new collection")

    time_now = datetime.datetime.now().strftime(r"%y-%m-%d_%H:%M:%S")
    collection_name = '_'.join([model_name, str(video_id), time_now])
    description = f"By {model_name} on video {video_id} at {time_now}"

    concept_names = pd_query(
        """
        SELECT name
        FROM concepts
        WHERE id IN %s
        """, params=(tuple(concept_ids),), con=con
    )['name'].tolist()

    cursor = con.cursor()
    cursor.execute(
        """
        INSERT INTO annotation_collection
        (name, description, users, videos, concepts, tracking, conceptid)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (collection_name, description, [user_id], [video_id], concept_names,
         False, concept_ids)
    )
    con.commit()
    collection_id = int(cursor.fetchone()[0])

    return collection_id