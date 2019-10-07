import os
import time
import subprocess

from botocore.exceptions import ClientError

import upload_stdout
from predict.evaluate_prediction_vid import evaluate
from train.train import train_model
from config import config
from utils.query import s3, con, cursor, pd_query


def main():
    """ We train a model and then use it to predict on the specified videos
    """
    # This process periodically uploads the stdout and stderr files
    # To the S3 bucket. The website uses these to display stdout and stderr
    pid = os.getpid()
    upload_process = upload_stdout.start_uploading(pid)
    model, model_params = get_model_and_params()

    concepts = model["concepts"]
    verify_videos = model["verificationvideos"]
    user_model = model["name"] + "-" + time.ctime()
    
    delete_old_model_user(model)
    create_model_user(model_params, user_model)

    # This removes all of the [INFO] outputs from tensorflow.
    # We still see [WARNING] and [ERROR], but there's a lot less clutter
    os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

    # If set, training will sometimes be unable to save the model
    os.environ["HDF5_USE_FILE_LOCKING"] = "FALSE"

    start_training(concepts, verify_videos, model_params)
    setup_predict_progress(verify_videos)

    evaluate_videos(concepts, verify_videos, user_model)

    reset_model_params()
    shutdown_server()

def get_model_and_params():
    """ If they exist, get the selected model's old weights.
        Also grab the current training parameters from the database.
    """

    # Get annotation info from the model_params table
    model_params = pd_query(
        """
        SELECT * FROM model_params WHERE option='train'"""
    ).iloc[0]

    # Try to get the previously saved weights for the model,
    # If they don't exist (ClientError), use the default weights
    try:
        s3.download_file(
            config.S3_BUCKET,
            config.S3_WEIGHTS_FOLDER + str(model_params["model"]) + ".h5",
            config.WEIGHTS_PATH,
        )
    except ClientError:
        s3.download_file(
            config.S3_BUCKET,
            config.S3_WEIGHTS_FOLDER + config.DEFAULT_WEIGHTS_PATH,
            config.WEIGHTS_PATH,
        )

    model = pd_query(
        """SELECT * FROM models WHERE name=%s""", (str(model_params["model"]),)
    ).iloc[0]

    return model, model_params

def delete_old_model_user(model):
    """ Delete the old model's user
    """
    if model["userid"] != None:
        cursor.execute(
            """
             DELETE FROM users
             WHERE id=%s""",
            (int(model["userid"]),),
        )
        con.commit()


def create_model_user(model_params, user_model):
    """Insert a new user for this model, then update the models table
       with the new user's id
    """

    cursor.execute(
        """
        INSERT INTO users (username, password, admin)
        VALUES (%s, 0, null)
        RETURNING *""",
        (user_model,),
    )
    con.commit()
    model_user_id = int(cursor.fetchone()[0])

    # Update the models table with the new user
    cursor.execute(
        """
        UPDATE models
        SET userid=%s
        WHERE name=%s
        """,
        (model_user_id, model_params["model"]),
    )

    return model_user_id

def start_training(concepts, verify_videos, model_params):
    """Start a training job with the correct parameters
    """

    train_model(
        concepts,
        verify_videos,
        model_params["model"],
        model_params["annotation_collections"],
        int(model_params["min_images"]),
        int(model_params["epochs"]),
        download_data=True,
        verified_only=model_params["verified_only"],
        include_tracking=model_params["include_tracking"],
    )

def setup_predict_progress(verify_videos):
    """Reset the predict progress table for new predictions"""

    # Just to be sure in case of web app not deleting the progress
    # we clear the prediction progress table
    cursor.execute("""DELETE FROM predict_progress""")
    con.commit()
    cursor.execute(
        """
        INSERT INTO predict_progress (videoid, current_video, total_videos)
        VALUES (%s, %s, %s)""",
        (0, 0, len(verify_videos)),
    )
    con.commit()

def evaluate_videos(concepts, verify_videos, user_model):
    """ Run evaluate on all the evaluation videos
    """

    # We go one by one as multiprocessing ran into memory issues
    for video_id in verify_videos:
        cursor.execute(
            f"""UPDATE predict_progress SET videoid = {video_id}, current_video = current_video + 1"""
        )
        con.commit()
        evaluate(video_id, user_model, concepts)

    # Status level 4 on a video means that predictions have completed.
    cursor.execute(
        """
        UPDATE predict_progress
        SET status=4
        """
    )
    con.commit()

def reset_model_params():
    """ Reset the model_params table
    """
    cursor.execute(
        """
        Update model_params
        SET epochs = 0, min_images=0, model='', annotation_collections=ARRAY[]:: integer[],
            verified_only=null, include_tracking=null
        WHERE option='train'
        """
    )
    con.commit()
    con.close()

def shutdown_server():
    """ Shutdown this EC2 instance
    """

    subprocess.call(["sudo", "shutdown", "-h"])


if __name__ == '__main__':
    main()
