import os
import time
import subprocess

from psycopg2 import connect
from botocore.exceptions import ClientError
import boto3

from evaluate_prediction_vid import evaluate
from train import train_model
import config


s3 = boto3.client(
    's3',
    aws_access_key_id=config.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=config.AWS_SECRET_ACCESS_KEY
)

con = connect(
    database=config.DB_NAME,
    host=config.DB_HOST,
    user=config.DB_USER,
    password=config.DB_PASSWORD
)

cursor = con.cursor()

# Delete old prediction progress
cursor.execute('''
    DELETE FROM
      predict_progress
''')
con.commit()

# get annotations from test
cursor.execute("SELECT * FROM MODELTAB WHERE option='trainmodel'")
row = cursor.fetchone()
info = row[1]

try:
    s3.download_file(
        config.S3_BUCKET,
        config.S3_WEIGHTS_FOLDER + str(info['modelSelected']) + '.h5',
        config.WEIGHTS_PATH
    )
except ClientError:
    s3.download_file(
        config.S3_BUCKET,
        config.S3_WEIGHTS_FOLDER + config.DEFAULT_WEIGHTS_PATH,
        config.WEIGHTS_PATH
    )

cursor.execute(
    '''SELECT * FROM MODELS WHERE name=%s''',
    (info['modelSelected'],)
)

model = cursor.fetchone()
concepts = model[2]
verifyVideos = model[3]

# Delete old model user
# if (model[4] != 'None'):
#      cursor.execute('''
#          DELETE FROM users
#          WHERE id=%s''',
#          (model[4],))
# cursor.execute(
#     '''INSERT INTO users (username, password, admin) VALUES (%s, 0, null) RETURNING *''',
#     (user_model,)
# )

# cursor.execute('''
#     INSERT INTO users (username, password, admin)
#     VALUES (%s, 0, null)
#     RETURNING *''',
#     (user_model,))
# model_user_id = int(cursor.fetchone()[0])

# update models
# cursor.execute('''
#     UPDATE models
#     SET userid=%s
#     WHERE name=%s
#     RETURNING *''',
#     (model_user_id, info['modelSelected'],))

# Start training job
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
train_model(concepts, info['modelSelected'], info['annotationCollections'],
            int(info['minImages']), int(info['epochs']), download_data=True)

# Run verifyVideos in parallel
# with Pool(processes = 2) as p:
#     p.starmap(evaluate, map(lambda video: (video, user_model, concepts), verifyVideos))

# Run evaluate on all the videos in verifyVideos
# Using for loop due to memory issues
# for video_id in verifyVideos:
#     evaluate(video_id, user_model, concepts)
#     cursor.execute('''DELETE FROM predict_progress''')

subprocess.call(['rm', '*.mp4'])

cursor.execute('''
    Update modeltab
    SET info =  '{
        \"activeStep\": 0, \"modelSelected\":\"\", \"annotationCollections\":[],
        \"epochs\":0, \"minImages\":0}'
    WHERE option = 'trainmodel'
''')

con.commit()
con.close()
subprocess.call(['sudo', 'shutdown', '-h'])
