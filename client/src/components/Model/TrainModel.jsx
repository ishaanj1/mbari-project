import React, { Component } from 'react';
import axios from 'axios';
import TextField from '@material-ui/core/TextField';
import io from 'socket.io-client';
import { withStyles } from '@material-ui/core/styles';
import Stepper from '@material-ui/core/Stepper';
import Step from '@material-ui/core/Step';
import StepLabel from '@material-ui/core/StepLabel';
import StepContent from '@material-ui/core/StepContent';
import Button from '@material-ui/core/Button';
import Paper from '@material-ui/core/Paper';
import { FormControl } from '@material-ui/core';
import InputLabel from '@material-ui/core/InputLabel';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import FormGroup from '@material-ui/core/FormGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormLabel from '@material-ui/core/FormLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Typography from '@material-ui/core/Typography';

import ModelProgress from './ModelProgress';
import VideoMetadata from '../Utilities/VideoMetadata';

const styles = theme => ({
  root: {
    margin: '40px 180px'
  },
  form: {
    marginBottom: theme.spacing(2),
    marginLeft: theme.spacing(1),
    minWidth: 150
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center'
  },
  container: {
    display: 'flex',
    flexDirection: 'row',
    padding: '20px',
    height: '560px'
  },
  stepper: {
    display: 'block',
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'left',
    width: '50%'
  },
  progress: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'right',
    alignItems: 'right',
    width: '50%'
  },
  button: {
    marginTop: theme.spacing(),
    marginRight: theme.spacing()
  },
  actionsContainer: {
    flexDirection: 'column',
    justifyContent: 'left',
    marginBottom: theme.spacing(2)
  },
  resetContainer: {
    padding: theme.spacing(3)
  },
  checkSelector: {
    maxHeight: '150px',
    overflow: 'auto'
  },
  videoSelector: {
    width: '625px'
  },
  hyperparametersForm: {
    display: 'flex',
    flexWrap: 'wrap'
  },
  textField: {
    marginLeft: theme.spacing(),
    marginRight: theme.spacing(),
    width: 200
  },
  epochText: {
    position: 'relative',
    top: '-15px'
  },
  hyperParamsInput: {
    width: '190ox',
    marginRight: '10px'
  }
});

class TrainModel extends Component {
  constructor(props) {
    super(props);
    // here we do a manual conditional proxy because React won't do it for us
    let socket;
    if (window.location.origin === 'http://localhost:3000') {
      console.log('manually proxying socket');
      socket = io('http://localhost:3001');
    } else {
      socket = io();
    }
    socket.on('connect', () => {
      console.log('socket connected!');
    });
    socket.on('reconnect_attempt', attemptNumber => {
      console.log('reconnect attempt', attemptNumber);
    });
    socket.on('disconnect', reason => {
      console.log(reason);
    });
    socket.on('refresh trainmodel', this.loadOptionInfo);

    this.state = {
      models: [],
      modelSelected: null,
      collections: [],
      annotationCollections: [],
      minImages: 5000,
      epochs: 0,
      activeStep: 0,
      openedVideo: null,
      currentEpoch: 0,
      currentBatch: 0,
      socket
    };
  }

  // Methods for video meta data
  openVideoMetadata = (event, video) => {
    event.stopPropagation();
    this.setState({
      openedVideo: video
    });
  };

  closeVideoMetadata = () => {
    this.setState({
      openedVideo: null
    });
  };

  componentDidMount = async () => {
    this.loadOptionInfo();
    this.loadExistingModels();
  };

  loadOptionInfo = () => {
    const config = {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    };
    const option = 'trainmodel';
    axios
      .get(`/api/models/train/${option}`, config)
      .then(res => {
        const { info } = res.data[0];
        this.setState({
          activeStep: info.activeStep,
          annotationCollections: info.annotationCollections,
          modelSelected: info.modelSelected,
          minImages: info.minImages,
          epochs: info.epochs
        });
      })
      .catch(error => {
        console.log('Error in get /api/models');
        console.log(error);
        if (error.response) {
          console.log(error.response.data.detail);
        }
      });
  };

  loadExistingModels = () => {
    const config = {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    };
    axios
      .get(`/api/models`, config)
      .then(res => {
        this.setState({
          models: res.data
        });
      })
      .catch(error => {
        console.log('Error in get /api/models');
        console.log(error);
        if (error.response) {
          console.log(error.response.data.detail);
        }
      });
  };

  loadCollectionlist = () => {
    const { models, modelSelected } = this.state;
    const config = {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    };
    axios.get(`/api/collections/annotations`, config).then(res => {
      const selectedModelTuple = models.find(model => {
        return model.name === modelSelected;
      });
      this.filterCollection(selectedModelTuple, res.data);
    });
  };

  // Used to handle changes in the hyperparameters and in the select model
  handleChange = event => {
    this.setState({
      [event.target.name]: event.target.value
    });
  };

  selectModel = () => {
    const { classes } = this.props;
    const { modelSelected, models } = this.state;
    if (modelSelected === null) {
      return <div>Loading...</div>;
    }
    return (
      <FormControl className={classes.form}>
        <InputLabel>Select Model</InputLabel>
        <Select
          name="modelSelected"
          value={modelSelected}
          onChange={this.handleChange}
        >
          {models.map(model => (
            <MenuItem key={model.name} value={model.name}>
              {model.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  };

  // Handle user, video, and concept checkbox selections
  checkboxSelect = (stateName, stateValue, id) => event => {
    let deepCopy = JSON.parse(JSON.stringify(stateValue));
    if (event.target.checked) {
      deepCopy.push(id);
    } else {
      deepCopy = deepCopy.filter(user => user !== id);
    }
    this.setState({
      [stateName]: deepCopy
    });
  };

  selectCollection = () => {
    const { classes } = this.props;
    const { annotationCollections, collections } = this.state;

    const { checkSelector } = classes;
    if (!annotationCollections) {
      return <div>Loading...</div>;
    }
    return (
      <FormControl component="fieldset" className={checkSelector}>
        <FormLabel component="legend">
          Select Annotation Collection to Use
        </FormLabel>
        <FormGroup>
          {collections
            .sort(a => (a.validConcepts ? -1 : 1))
            .map(collection => (
              <div key={collection.id}>
                <FormControlLabel
                  control={
                    <Checkbox
                      onChange={this.checkboxSelect(
                        'annotationCollections',
                        annotationCollections,
                        collection.id
                      )}
                      color="primary"
                      checked={annotationCollections.includes(collection.id)}
                      disabled={collection.disable}
                    />
                  }
                  label={
                    <div>
                      {collection.name}
                      {collection.validConcepts ? (
                        <Typography
                          variant="subtitle2"
                          gutterBottom
                          color="secondary"
                        >
                          {collection.validConcepts.concepts.join(', ')}
                        </Typography>
                      ) : (
                        ''
                      )}
                    </div>
                  }
                />
              </div>
            ))}
        </FormGroup>
      </FormControl>
    );
  };

  selectHyperparameters = () => {
    const { classes } = this.props;
    const { epochs, minImages } = this.state;

    const label = (
      <span className={classes.epochText}>
        Number of epochs <br />
        (0 = Until Increased Loss)
      </span>
    );

    return (
      <form className={classes.hyperparametersForm}>
        <TextField
          margin="normal"
          name="epochs"
          label={label}
          value={epochs}
          onChange={this.handleChange}
          className={classes.hyperParamsInput}
        />
        <TextField
          margin="normal"
          name="minImages"
          label="Number of training images"
          value={minImages}
          onChange={this.handleChange}
        />
      </form>
    );
  };

  getSteps = () => {
    return [
      'Select model',
      'Select annotation collection',
      'Select hyperparameters'
    ];
  };

  getStepContent = step => {
    switch (step) {
      case 0:
        return this.selectModel();
      case 1:
        return this.selectCollection();
      case 2:
        return this.selectHyperparameters();
      default:
        return 'Unknown step';
    }
  };

  getStepState = step => {
    switch (step) {
      case 0:
        return 'models';
      case 1:
        return 'collections';
      default:
        return undefined;
    }
  };

  handleSelectAll = () => {
    const { activeStep } = this.state;

    const stateName = this.getStepState(activeStep);
    // eslint-disable-next-line react/destructuring-assignment
    const data = this.state[stateName];
    const dataSelected = JSON.parse(
      // eslint-disable-next-line react/destructuring-assignment, react/no-access-state-in-setstate
      JSON.stringify(this.state[`${stateName}Selected`])
    );
    data.forEach(row => {
      if (!dataSelected.includes(row.id)) {
        dataSelected.push(row.id);
      }
    });
    this.setState({
      [`${stateName}Selected`]: dataSelected
    });
  };

  handleUnselectAll = () => {
    const { activeStep } = this.state;

    const stateName = this.getStepState(activeStep);
    this.setState({
      [`${stateName}Selected`]: []
    });
  };

  updateBackendInfo = () => {
    const {
      activeStep,
      modelSelected,
      annotationCollections,
      epochs,
      minImages,
      socket
    } = this.state;

    const config = {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    };
    const info = {
      activeStep,
      modelSelected,
      annotationCollections,
      epochs,
      minImages
    };
    const body = {
      info: JSON.stringify(info)
    };
    // update SQL database
    axios
      .put('/api/models/train/trainmodel/', body, config)
      .then(() => {
        socket.emit('refresh trainmodel');
      })
      .catch(error => {
        console.log(error);
        console.log(JSON.parse(JSON.stringify(error)));
      });
  };

  filterCollection = async (data, collections) => {
    const config = {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    };
    try {
      let dataRet = await axios.get(
        `/api/collections/annotations/train?ids=${data.conceptsid}`,
        config
      );
      const conceptids = dataRet.data.map(col => col.id);
      dataRet = dataRet.data;
      const filteredCol = collections;
      filteredCol.forEach(col => {
        if (!conceptids.includes(col.id)) {
          col.disable = true;
        } else {
          col.disable = false;
          col.validConcepts = dataRet.find(col1 => {
            return col1.id === col.id;
          });
        }
      });
      await this.setState({
        collections: filteredCol
      });
    } catch (error) {
      console.log(error);
    }
  };

  handleNext = async () => {
    const { activeStep } = this.state;
    // After users have been selected load user videos
    if (activeStep === 0) {
      this.loadCollectionlist();
    }
    // After Model and videos have been selected load available concepts
    // if (this.state.activeStep === 2) {
    //   await this.loadConceptList();
    // }
    this.setState(
      state => ({
        activeStep: state.activeStep + 1
      }),
      () => {
        if (activeStep === 3) {
          this.postModelInstance('start');
        }
        this.updateBackendInfo();
      }
    );
  };

  handleBack = () => {
    this.setState(
      state => ({
        activeStep: state.activeStep - 1
      }),
      () => {
        this.updateBackendInfo();
      }
    );
  };

  handleStop = () => {
    this.setState(
      {
        activeStep: 0
      },
      () => {
        this.updateBackendInfo();
        this.postModelInstance('stop');
      }
    );
  };

  postModelInstance = command => {
    const config = {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    };
    const body = {
      command,
      modelInstanceId: 'i-011660b3e976035d8'
    };
    axios.post(`/api/models/train`, body, config).then(res => {
      console.log(res);
    });
  };

  render() {
    const { classes, socket, loadVideos } = this.props;
    const {
      annotationCollections,
      modelSelected,
      activeStep,
      openedVideo
    } = this.state;

    const steps = this.getSteps();

    return (
      <div className={classes.root}>
        <Paper square>
          <div className={classes.container}>
            <Stepper
              className={classes.stepper}
              activeStep={activeStep}
              orientation="vertical"
            >
              {steps.map((label, index) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                  <StepContent>
                    {this.getStepContent(index)}
                    <div className={classes.actionsContainer}>
                      <Button
                        disabled={activeStep === 0}
                        onClick={this.handleBack}
                        className={classes.button}
                      >
                        Back, socket, loadVideos
                      </Button>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={this.handleNext}
                        className={classes.button}
                        disabled={
                          (activeStep === 0 && modelSelected === '') ||
                          (activeStep === 1 && annotationCollections.length < 1)
                        }
                      >
                        {activeStep === steps.length - 1
                          ? 'Train Model'
                          : 'Next'}
                      </Button>
                      <Button
                        onClick={this.handleSelectAll}
                        disabled={activeStep === 0 || activeStep === 4}
                      >
                        Select All
                      </Button>
                      <Button
                        onClick={this.handleUnselectAll}
                        disabled={activeStep === 0 || activeStep === 4}
                      >
                        Unselect All
                      </Button>
                    </div>
                  </StepContent>
                </Step>
              ))}
            </Stepper>
            <ModelProgress
              className={classes.progress}
              activeStep={activeStep}
              steps={steps}
              handleStop={this.handleStop}
            />
          </div>
        </Paper>
        {openedVideo && (
          <VideoMetadata
            open
            handleClose={this.closeVideoMetadata}
            openedVideo={openedVideo}
            socket={socket}
            loadVideos={loadVideos}
            modelTab
          />
        )}
      </div>
    );
  }
}

export default withStyles(styles)(TrainModel);
