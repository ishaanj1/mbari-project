import os
import datetime

import keras
import boto3
from psycopg2 import connect

import config


class TensorboardLog(keras.callbacks.Callback):

    def __init__(self, model_name, job_id, min_examples, epochs, collection_ids):

        self.table_name = 'previous_runs'
        self.job_id = job_id

        self.connection = connect(
            database=config.DB_NAME,
            host=config.DB_HOST,
            user=config.DB_USER,
            password=config.DB_PASSWORD
        )

        self.cursor = self.connection.cursor()

        self.client = boto3.client(
            's3',
            aws_access_key_id=config.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=config.AWS_SECRET_ACCESS_KEY
        )

        self._create_log_entry(
            model_name=model_name,
            min_examples=min_examples,
            epochs=epochs,
            collection_ids=collection_ids
        )

    def on_train_begin(self, logs={}):
        self.cursor.execute(
            f"""UPDATE
                {self.table_name}
            SET
                start_train=%s
            WHERE
                id=%s""",
            (datetime.datetime.now(), self.id))

        self.connection.commit()

    def on_train_end(self, logs={}):
        self.cursor.execute(
            f"""UPDATE
                {self.table_name}
            SET
                end_train=%s
            WHERE
                id=%s""",
            (datetime.datetime.now(), self.id))

        self.connection.commit()

    def on_epoch_begin(self, epoch, logs={}):
        return

    def on_epoch_end(self, epoch, logs={}):
        path = f'./logs/{self.id}'

        for root, dirs, files in os.walk(path):
            for file in files:
                self.client.upload_file(
                    os.path.join(root, file), self.bucket, f'{self.logs_dir}{self.job_id}/{file}'
                )

    def on_batch_begin(self, batch, logs={}):
        return

    def on_batch_end(self, batch, logs={}):
        return

    def _create_log_entry(self, model_name, job_id, min_examples, epochs, collection_ids):
        self.cursor.execute(
            f"""INSERT INTO {self.table_name}
                    (model_name, job_id, epochs, min_examples, collection_ids)
                VALUES
                    (%s, %s, %s, %s)""",
            (model_name, self.job_id, epochs, min_examples, collection_ids))

        self.connection.commit()
