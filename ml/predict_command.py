from psycopg2 import connect
import subprocess
from dotenv import load_dotenv
import boto3
import json
from utils.query import s3, con, cursor
from config.config import S3_BUCKET, S3_WEIGHTS_FOLDER, WEIGHTS_PATH
from train_command import setup_predict_progress, evaluate_videos, end_predictions, shutdown_server
from botocore.exceptions import ClientError


def main():
    '''
    get predict params
    returns a list elements:
    model - string: name of the model
    userid - int: model's userid
    concepts - int[]: list of concept ids model is trying to find
    video - int: id of video to predict on
    upload_annotations - boolean: if true upload annotations to database
    '''

    try:
        params = pd_query("SELECT * FROM predict_params").iloc[0]
        model_name = params["model"]
        concepts = params["concepts"]
        videoids = params["videos"]
        upload_annotations = params["upload_annotations"]
        version = params["version"]

        user_model = model_name + "-" + version
        download_weights(user_model)
        setup_predict_progress(videoids)
        evaluate_videos(concepts, videoids, user_model, upload_annotations,
                        userid)
    except Exception as e:
        raise e
    finally:
        reset_predict_params()
        shutdown_server()


def download_weights(user_model):
    filename = user_model + '.h5'
    try:
        s3.download_file(
            S3_BUCKET,
            S3_WEIGHTS_FOLDER + filename,
            WEIGHTS_PATH
        )
        print("downloaded file: {0}".format(filename))
    except ClientError as e:
        print("Could not find weights file {0} in S3".format(filename))
        raise e


def reset_predict_params():
    """ Reset the predict_params table
    """
    print("resetting model_params")
    cursor.execute(
        """
        UPDATE predict_params
        SET model='', userid=-1, concepts=ARRAY[]::integer[],
            upload_annotations=false, videos=ARRAY[]::integer[],
            version='0', create_collection=false
        """
    )
    con.commit()


if __name__ == '__main__':
    main()