# USAGE
# python tracking.py

# import the necessary packages
from imutils.video import VideoStream
import imutils
import cv2
from pgdb import connect
import boto3
import os
from dotenv import load_dotenv
import datetime
import copy
import time
import uuid
import sys

#Load environment variables
load_dotenv(dotenv_path="../.env")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
S3_BUCKET = os.getenv('AWS_S3_BUCKET_NAME')
s3 = boto3.client('s3', aws_access_key_id = AWS_ACCESS_KEY_ID, aws_secret_access_key = AWS_SECRET_ACCESS_KEY)
S3_ANNOTATION_FOLDER = os.getenv("AWS_S3_BUCKET_ANNOTATIONS_FOLDER")
S3_VIDEO_FOLDER = os.getenv('AWS_S3_BUCKET_VIDEOS_FOLDER')
S3_TRACKING_FOLDER = os.getenv("AWS_S3_BUCKET_TRACKING_FOLDER")

# connect to db
DB_NAME = os.getenv("DB_NAME")
DB_HOST = os.getenv("DB_HOST")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

# video/image properties
length = 4000 # length of video before and after annotation in ms (ex: length = 4000, vid = 8 s max)
images_per_sec = 10
VIDEO_WIDTH = 640
VIDEO_HEIGHT = 360

# initialize a dictionary that maps strings to their corresponding
# OpenCV object tracker implementations
OPENCV_OBJECT_TRACKERS = {
	"csrt": cv2.TrackerCSRT_create,
	"kcf": cv2.TrackerKCF_create,
	"boosting": cv2.TrackerBoosting_create,
	"mil": cv2.TrackerMIL_create,
	"tld": cv2.TrackerTLD_create,
	"medianflow": cv2.TrackerMedianFlow_create,
	"mosse": cv2.TrackerMOSSE_create
}

def get_next_frame(frames, video_object, num):
	if video_object:
		check, frame = frames.read()
	else:
                if len(frames) == 0:
                        return None
                frame = frames.pop()
	return frame

#Uploads images and adds annotation to database
def upload_image(name, frame, frame_w_box, annotation, x1, y1, x2, y2, cursor, con, AI_ID):
	no_box = str(annotation.id) + "_" + name + "_ai.png"
	box = str(annotation.id) + "_" + name + "_box_ai.png"
	temp_file = str(uuid.uuid4()) + ".png"
	cv2.imwrite(temp_file, frame)
	s3.upload_file(temp_file, S3_BUCKET, S3_ANNOTATION_FOLDER + no_box, ExtraArgs={'ContentType':'image/png'}) 
	os.system('rm '+ temp_file)
	cv2.imwrite(temp_file, frame_w_box)
	s3.upload_file(temp_file, S3_BUCKET, S3_ANNOTATION_FOLDER + box,  ExtraArgs={'ContentType':'image/png'})
	os.system('rm '+ temp_file)
	cursor.execute(
		"""
			INSERT INTO annotations (
			videoid, userid, conceptid, timeinvideo, x1, y1, x2, y2, 
			videowidth, videoheight, dateannotated, image, imagewithbox, comment, unsure, originalid) 
			VALUES (%d, %d, %d, %f, %f, %f, %f, %f, %d, %d, %s, %s, %s, %s, %s, %d)
		""",
		(
			annotation.videoid, AI_ID, annotation.conceptid, annotation.timeinvideo, x1, y1, 
			x2, y2, VIDEO_WIDTH, VIDEO_HEIGHT, datetime.datetime.now().date(), no_box, box, 
			annotation.comment, annotation.unsure, annotation.id
		)
	)
	con.commit()

#Tracks the object forwards and backwards in a video
def track_object(frames, box, video_object, end, original, cursor, con, AI_ID):
        frame_list = []
        trackers = cv2.MultiTracker_create()

        # initialize bounding box in first frame
        frame = get_next_frame(frames, video_object, 0)
        if frame is None:
            return []
        frame = imutils.resize(frame, width=640, height=360)

        tracker = OPENCV_OBJECT_TRACKERS["kcf"]()
        trackers.add(tracker, frame, box)
        counter = 0
        images_counter = 20 / images_per_sec # vids are about 20 fps

        while True:
                frame = get_next_frame(frames, video_object, counter)
                if frame is None:
                        break
                frame = imutils.resize(frame, width=VIDEO_WIDTH, height=VIDEO_HEIGHT)
                frame_no_box = copy.deepcopy(frame)
                (success, boxes) = trackers.update(frame)
                if success:
                        for box in boxes:
                                (x, y, w, h) = [int(v) for v in box]
                                cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
                        frame_list.append(frame)
                        if (counter % images_counter == 0):
                                upload_image(str(int(counter // images_counter)), frame_no_box, frame, original, x, y, (x+w), (y+h), cursor, con, AI_ID)
                        counter += 1
                else:
                        break
                if (video_object and frames.get(0) > end): # only check for forward tracking
                        break
        cv2.destroyAllWindows()
        return frame_list

#original must be pgdb row
def ai_annotation(original):
        con = connect(database=DB_NAME, host=DB_HOST, user=DB_USER, password=DB_PASSWORD)
        cursor = con.cursor()

        #get AI userid
        cursor.execute("SELECT id FROM users WHERE username=%s", ("ai",))
        AI_ID = cursor.fetchone().id

	# get video name
        cursor.execute("SELECT filename FROM videos WHERE id=%s", (str(original.videoid),))
        video_name = cursor.fetchone().filename

	# grab video stream
        url = s3.generate_presigned_url('get_object', 
                Params = {'Bucket': S3_BUCKET, 
                    'Key': S3_VIDEO_FOLDER + video_name}, 
                ExpiresIn = 100)
        cap = cv2.VideoCapture(url)
	
        # initialize video for grabbing frames before annotation
        start = ((original.timeinvideo * 1000) - length) # start 3 secs before obj appears
        end = start + length # end when annotation occurs
        cap.set(0, start) # tell video to start at 'start' time
        check = True
        frame_list = []
        curr = start

        while (check and curr <= end):
            check, vid = cap.read()
            vid = imutils.resize(vid, width=VIDEO_WIDTH, height=VIDEO_HEIGHT)
            frame_list.append(vid)
            curr = int(cap.get(0))
        cap.release()


	# initialize vars for getting frames after annotation
        start = original.timeinvideo * 1000
        end = start + length
        x_ratio = (original.videowidth / VIDEO_WIDTH)
        y_ratio = (original.videoheight / VIDEO_HEIGHT)
        x1 = original.x1 / x_ratio
        y1 = original.y1 / y_ratio
        width = (original.x2 / x_ratio) - x1
        height = (original.y2 / y_ratio) - y1
        box = (x1, y1, width, height)
        
        # get object tracking frames prior to annotation
        frames = frame_list
        reverse_frames = track_object(frames, box, False, 0, original, cursor, con, AI_ID)
        reverse_frames.reverse()
        
        # new video capture object for frames after annotation
        vs = cv2.VideoCapture(url)
        vs.set(0, start)
        frames = vs
        forward_frames = track_object(frames, box, True, start + length, original, cursor, con, AI_ID)
        vs.release()
        
        output_file = str(uuid.uuid4()) + ".mp4"
        converted_file = str(uuid.uuid4()) + ".mp4"
        
        out = cv2.VideoWriter(output_file, cv2.VideoWriter_fourcc(*'mp4v'), 20, (VIDEO_WIDTH, VIDEO_HEIGHT))
        reverse_frames.extend(forward_frames)
        for frame in reverse_frames:
            out.write(frame)		
            #cv2.imshow("Frame", frame)
            #cv2.waitKey(1)
            
        out.release()
        
        os.system('ffmpeg -loglevel 0 -i ' + output_file + ' -codec:v libx264 '+ converted_file)
        
        if os.path.isfile(converted_file):
            #upload video..
            s3.upload_file(
                converted_file, 
                S3_BUCKET, 
                S3_VIDEO_FOLDER + str(original.id) + "_ai.mp4", 
                ExtraArgs={'ContentType':'video/mp4'}
            )
            os.system('rm '+ converted_file)
        else:
            print("no video made for " + str(original.id))

        os.system('rm '+ output_file)
        cv2.destroyAllWindows()
        con.close()