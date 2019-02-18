from keras_retinanet.utils.eval import evaluate
import argparse
import os
from dotenv import load_dotenv
import json
import shutil
from loading_data import queryDB
from loading_data import download_annotations
import pandas as pd
from keras_retinanet import models
from keras_retinanet.utils.model import freeze as freeze_model
from keras.utils import multi_gpu_model
from keras_retinanet import losses
from keras_retinanet.preprocessing.csv_generator import CSVGenerator
from keras_retinanet.models.retinanet import retinanet_bbox
import keras
from model_scoring import f1_evaluation
from keras_retinanet.utils.eval import evaluate

argparser = argparse.ArgumentParser()
argparser.add_argument(
    '-c',
    '--conf',
    default='config.json',
    help='path to configuration file')
args = argparser.parse_args()
config_path = args.conf

load_dotenv(dotenv_path="../.env")
with open(config_path) as config_buffer:    
    config = json.loads(config_buffer.read())

concepts = config['conceptids']
train_annot_file = config['train_annot_file']
valid_annot_file = config['valid_annot_file']
img_folder = config['image_folder']

class_map_file = config['class_map']
min_examples = config['min_examples']
model_path = config['model_weights']
test_examples = config['test_examples']

bad_users = json.loads(os.getenv("BAD_USERS"))

'''
Just load classmap without loading new data
'''
classmap = pd.read_csv(class_map_file, header=None).to_dict()[0]
'''
Loading new data for evaluation
'''
'''
classmap = []
for concept in concepts:
    name = queryDB("select name from concepts where id=" + str(concept)).iloc[0]["name"]
    classmap.append([name,concepts.index(concept)])
classmap = pd.DataFrame(classmap)
classmap.to_csv(class_map_file,index=False, header=False)
classmap = classmap.to_dict()[0]

folders = []
folders.append(test_examples)
folders.append(img_folder)
for dir in folders:
    if os.path.exists(dir):
        shutil.rmtree(dir)
    os.makedirs(dir)
download_annotations(min_examples, concepts, classmap, bad_users, img_folder, train_annot_file, valid_annot_file, split=0)
'''
'''
Initializing model for eval
'''
model = models.backbone('resnet50').retinanet(num_classes=len(concepts), modifier=freeze_model)
model.load_weights(model_path, by_name=True, skip_mismatch=True)
model = retinanet_bbox(model)
test_generator = CSVGenerator(
    valid_annot_file,
    class_map_file,
    shuffle_groups=False,
    batch_size=16
)

max_f1, threshold = f1_evaluation(test_generator, model, save_path=test_examples)

print("Maximum F1 value: " + str(max_f1))
print("Best threshold value: " + str(threshold))

'''
average_precisions = evaluate(test_generator, model, save_path=test_examples)

for concept, (ap, instances) in average_precisions.items():
    print(classmap[concept] +": " + str(ap) + " with " + str(instances) + " instances")
    
print("Find evaluation examples in: " + test_examples)
'''