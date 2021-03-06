import React, { Component } from 'react';
import axios from 'axios';
import { withStyles } from '@material-ui/core/styles';
import TableBody from '@material-ui/core/TableBody';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Table from '@material-ui/core/Table';
import Swal from 'sweetalert2/src/sweetalert2';
import { Typography, Button, Paper } from '@material-ui/core';
import CircularProgress from '@material-ui/core/CircularProgress';

import Dialog from '@material-ui/core/Dialog';
import TableCell from '@material-ui/core/TableCell';

import ModelsTable from './ModelsTable';
import CreateModel from './CreateModel';

const styles = theme => ({
  root: {
    margins: 'auto',
    padding: '20px 12%'
  }
});

const CustomTableCell = withStyles(theme => ({
  head: {
    backgroundColor: theme.palette.common.black,
    color: theme.palette.common.white,
    fontSize: 14
  },
  body: {
    fontSize: 14
  }
}))(TableCell);

class Models extends Component {
  constructor(props) {
    super(props);
    this.state = {
      models: [],
      videoModalOpen: false,
      createOpen: false,
      trainOpen: false,
      predictOpen: false,
      infoOpen: false,
      selectedModel: '',
      versionOpen: false,
      metricLoaded: false,
      allMetrics: [],
      total: [],
      conceptCounts : [],
      showTotal: false,
      showTrainingData: false
    };
  }
  formatDate = version => {
    let d = new Date(version);
    return d.toUTCString().replace(' GMT', '');
  };

  componentDidMount = () => {
    this.loadExistingModels();
    this.loadRunningTensorboard();
  };

  loadAllMetrics = async model => {
    let allMetrics = [];
    if (!model.videos) {
      return null;
    }
    let videoJSON = await model.videos.find(group => {
      return group.version === model.version_selected.toString();
    });
    if (videoJSON && videoJSON.videos.length > 0) {
      await Promise.all(
        videoJSON.videos.map(async video => {
          let metric = await this.getMetrics(video);
          allMetrics.push({ name: video, metric: metric });
        })
      );
      return allMetrics;
    } else {
      return null;
    }
  };

  getMetrics = async video => {
    const config = {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    };
    let ret;
    try {
      const metrics = await axios.get(
        `/api/videos/aivideos/metrics?filename=${video}`,
        config
      );
      if (metrics) {
        ret = metrics.data;
      }
    } catch (error) {
      console.error('Error in summary.jsx get /api/videos/aivideos/metrics');
      console.error(error.response.data);
      ret = error.response;
    }
    return ret;
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
        let models = res.data;
        models.forEach(m => (m.start_trains = JSON.parse(m.start_trains)));
        this.setState({
          models
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

  loadRunningTensorboard = () => {
    const config = {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    };

    axios
      .get('/api/models/tensorboard/', config)
      .then(res => {
        this.setState({ launchedTB: parseInt(res.data.id, 10) });
      })
      .catch(error => {
        console.log('Error in get /api/models/tensorboard/');
        console.log(error);
        if (error.response) {
          console.log(error.response.data.detail);
        }
      });
  };

  openTensorboard = () => {
    const { launched } = this.state;

    if (launched !== null) {
      if (process.env.NODE_ENV === 'production') {
        const domain = window.location.hostname.replace(
          /(https?:\/\/)?(www.)?/i,
          ''
        );
        setTimeout(() => {
          window.open(`https://tensorboard.${domain}`, '_blank');
        }, 500);
      } else {
        window.open('http://localhost:6008', '_blank');
      }
    }
  };

  stopTensorboard = () => {
    const config = {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    };

    axios
      .delete(`/api/models/tensorboard/`, config)
      .then(() => {
        this.setState({
          launched: null
        });
      })
      .catch(error => {
        console.log('Error in get /api/models/tensorboard/');
        console.log(error);
        if (error.response) {
          console.log(error.response.data.detail);
        }
      });
  };

  launchTensorboard = id => {
    const config = {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    };

    const body = {
      command: 'launch'
    };
    console.log(id);

    this.setState({ loadingId: id });

    axios
      .post(`/api/models/tensorboard/${id}`, body, config)
      .then(() => {
        this.setState({ launched: id });
        this.openTensorboard();
      })
      .catch(error => {
        console.log('Error in get /api/models/tensorboard/');
        console.log(error);
        if (error.response) {
          console.log(error.response.data.detail);
        }
      })
      .finally(() => this.setState({ loadingId: null }));
  };

  handleCloseInfo = () => {
    this.setState({
      infoOpen: false,
      total: [],
      showTotal: false,
      showTrainingData: false
    });
  };

  handleOpenInfo = async model => {
    this.setState({
      infoOpen: true,
      selectedModel: model
    });
    let result = await this.loadAllMetrics(model);
    this.setState({
      allMetrics: result,
      metricLoaded: true
    });
  };

  deleteModel = async model => {
    const config = {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      data: {
        model
      }
    };
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      type: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!'
    }).then(async result => {
      if (result.value) {
        try {
          await axios.delete('/api/models', config);
          Swal.fire('Deleted!', 'Model has been deleted.', 'success');
          this.loadExistingModels();
        } catch (error) {
          Swal.fire(error, '', 'error');
        }
      }
    });
  };

  setDecimal = data => {
    if (data === '') {
      return '0.0';
    }
    if (Number.isInteger(parseFloat(data))) {
      return data;
    }
    return parseFloat(data).toFixed(3);
  };

  toggleStateVariable = (condition, variable) => {
    this.setState({
      [variable]: condition
    });
  };

  handleSelectVersion = (id, model) => {
    const { models } = this.state;
    let selectedModel = models.find(m => m.name === model);

    selectedModel.version_selected = id;

    this.setState({ models });
  };

  handleClickVideo = async (name, videos) => {
    let currentVideo = await videos.find(video => video === name);
    this.setState({
      videoModalOpen: true,
      currentVideo
    });
  };

  showTotal = () => {
    const { allMetrics, showTotal } = this.state;

    let total = [];
    allMetrics.forEach(metric => {
      metric.metric.forEach((concept, index) => {
        if (!total[index]) {
          total[index] = JSON.parse(JSON.stringify(concept));
        } else {
          total[index].TP = parseInt(total[index].TP) + parseInt(concept.TP);
          total[index].FP = parseInt(total[index].FP) + parseInt(concept.FP);
          total[index].FN = parseInt(total[index].FN) + parseInt(concept.FN);
          total[index].pred_num =
            parseInt(Math.floor(total[index].pred_num)) +
            parseInt(Math.floor(concept.pred_num));
          total[index].true_num =
            parseInt(Math.floor(total[index].true_num)) +
            parseInt(Math.floor(concept.true_num));
        }
      });
    });
    total.forEach(concept => {
      concept.Precision = concept.TP / (concept.TP + concept.FP);
      concept.Recall = concept.TP / (concept.TP + concept.FN);
      concept.F1 =
        (2 * concept.Precision * concept.Recall) /
        (concept.Precision + concept.Recall);
      let prediciton_error =
        concept.true_num <= 0
          ? 1
          : Math.abs(concept.true_num - concept.pred_num) /
            Math.max(concept.true_num, concept.pred_num);
      concept.count_accuracy = 1 - prediciton_error;
    });
    this.setState({
      total,
      showTotal: !showTotal
    });
  };
  showTrainingData = () => {
    const { selectedModel, showTrainingData } = this.state;
    let version_index = parseFloat(selectedModel.version_selected)
    let concept_dict = {}
    selectedModel['epochs'] = 0
    if(showTrainingData === true) { // if you're trying to close the table by clicking again.
      this.setState({
        conceptCounts: {},
        showTrainingData: !showTrainingData // open if closed and vice versa.
      });
      return // immediately quit because no point in making table if we're closing it.
    }
    // iterate through each version
    for (let i = 0; i < selectedModel.concept_counts.length; i++) {
      let version_count = selectedModel.concept_counts[i]
      // if this is not the right version, continue iterating
      if(version_index !== parseFloat(version_count.version)) {
        continue;
      }
      // repeated for old models (otherwise if the counts don't exist, can't update epoch)
      selectedModel['epochs'] = version_count.epochs
      // if the counts is null (old model or failed training) continue searching.
      if(version_count.counts === null) {
        continue
      }
      selectedModel['epochs'] = version_count.epochs
      // iterate through each user
      Object.keys(version_count.counts).forEach(function(key) {
        // iterate through each concept
        Object.keys(version_count.counts[key]).forEach(function(conceptKey) {
          if(!(conceptKey in concept_dict)) { // piggyback on if statement for other dict.
            concept_dict[conceptKey] = {
              'concept_id' : conceptKey,
              'num_annotations': 0,
              'verified_annotations': 0,
              'tracking_annotations': 0
            }
          }
          // iterate through each binary (0/1) for unverified/verified counts.
          Object.keys(version_count.counts[key][conceptKey]).forEach(function(binaryKey) {
            concept_dict[conceptKey]['num_annotations'] += version_count.counts[key][conceptKey][binaryKey]
            if(binaryKey === '1') {
              concept_dict[conceptKey]['verified_annotations'] += version_count.counts[key][conceptKey][binaryKey]
            }
            if(key === '32') {
              concept_dict[conceptKey]['tracking_annotations'] += version_count.counts[key][conceptKey][binaryKey]
            }
          })
        })
      })
      break // done getting concept counts, don't need to continue the for loop.
      // b/c can't have 2 versions with the same version #
    }
    let conceptCount = concept_dict
    let dataObject = []
    Object.keys(conceptCount).forEach(function(key) {
      dataObject.push(conceptCount[key])
    })
    this.setState({
      conceptCounts: dataObject,
      showTrainingData: !showTrainingData // open if closed and vice versa.
    });
  };

  displayTrainingData = () => {
    const { showTrainingData, conceptCounts, selectedModel } = this.state;
    if (showTrainingData) {
      return (
        <Paper style={{ maxHeight: 400, overflow: 'auto' }}>
          <Typography variant="h5" color="primary">
            Training Data Metrics for {selectedModel.epochs} epochs.
          </Typography>
          {this.conceptMetric(conceptCounts)}
        </Paper>
      );
    } else {
      return '';
    }
  };

  conceptMetric = data => {
    const { classes } = this.props;
    return (
      <Table className={classes.table}>
        <TableHead>
          <TableRow>
            <TableCell>ConceptId</TableCell>
            <TableCell>Num Annotations</TableCell>
            <TableCell>Verified Annotations</TableCell>
            <TableCell>Tracking Annotations</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map(row => (
            <TableRow key={row.concept_id}>
              <TableCell>{row.concept_id}</TableCell>
              <TableCell>{row.num_annotations}</TableCell>
              <TableCell>{row.verified_annotations}</TableCell>
              <TableCell>{row.tracking_annotations}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  displayTotal = () => {
    const { showTotal, total } = this.state;
    if (showTotal) {
      return (
        <Paper style={{ maxHeight: 400, overflow: 'auto' }}>
          <Typography variant="h5" color="primary">
            Total Metrics
          </Typography>
          {this.metrics(total)}
        </Paper>
      );
    } else {
      return '';
    }
  };

  metrics = data => {
    const { classes } = this.props;
    return (
      <Table className={classes.table}>
        <TableHead>
          <TableRow>
            <TableCell>ConceptId</TableCell>
            <TableCell>TP</TableCell>
            <TableCell>FP</TableCell>
            <TableCell>FN</TableCell>
            <TableCell>Precision</TableCell>
            <TableCell>Recall</TableCell>
            <TableCell>F1</TableCell>
            <TableCell>pred_num</TableCell>
            <TableCell>true_num</TableCell>
            <TableCell>count_accuracy</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map(row => (
            <TableRow key={row.conceptid}>
              <TableCell>{row.conceptid}</TableCell>
              <TableCell>{row.TP}</TableCell>
              <TableCell>{row.FP}</TableCell>
              <TableCell>{row.FN}</TableCell>
              <TableCell>{this.setDecimal(row.Precision)}</TableCell>
              <TableCell>{this.setDecimal(row.Recall)}</TableCell>
              <TableCell>{this.setDecimal(row.F1)}</TableCell>
              <TableCell>{this.setDecimal(row.pred_num)}</TableCell>
              <TableCell>{this.setDecimal(row.true_num)}</TableCell>
              <TableCell>{this.setDecimal(row.count_accuracy)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  render() {
    const { classes } = this.props;
    const {
      models,
      videoModalOpen,
      currentVideo,
      infoOpen,
      selectedModel,
      createOpen,
      trainOpen,
      predictOpen,
      versionOpen,
      allMetrics,
      metricLoaded
    } = this.state;

    if (!models) {
      return <Typography style={{ margin: '20px' }}>Loading...</Typography>;
    }
    return (
      <div className={classes.root}>
        <Button
          style={{ marginBottom: '20px' }}
          variant="contained"
          color="primary"
          onClick={() => this.toggleStateVariable(true, 'createOpen')}
        >
          Create Model
        </Button>
        <CreateModel
          loadExistingModels={this.loadExistingModels}
          createOpen={createOpen}
          toggleStateVariable={this.toggleStateVariable}
        />
        <ModelsTable
          models={models}
          handleSelectVersion={this.handleSelectVersion}
          handleOpenInfo={this.handleOpenInfo}
          deleteModel={this.deleteModel}
          formatDate={this.formatDate}
          videoModalOpen={videoModalOpen}
          handleClickVideo={this.handleClickVideo}
          toggleStateVariable={this.toggleStateVariable}
          currentVideo={currentVideo}
          trainOpen={trainOpen}
          predictOpen={predictOpen}
          versionOpen={versionOpen}
          launchTensorboard={this.launchTensorboard}
        />
        {infoOpen && (
          <Dialog onClose={this.handleCloseInfo} open={infoOpen}>
            <Paper style={{ padding: '20px' }}>
              {metricLoaded && allMetrics ? (
                <React.Fragment>
                  {this.displayTotal()}
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={this.showTotal}
                  >
                    Get Total
                  </Button>
                  {this.displayTrainingData()}
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={this.showTrainingData}
                  >
                    Get Training Data
                  </Button>
                  {allMetrics.map(metrics => (
                    <div key={metrics.name}>
                      <Typography variant="h5" color="primary">
                        {metrics.name}
                      </Typography>
                      <Paper style={{ maxHeight: 400, overflow: 'auto' }}>
                        {this.metrics(metrics.metric)}
                      </Paper>
                    </div>
                  ))}
                </React.Fragment>
              ) : selectedModel.version_selected !== 0 ? (
                <div
                  style={{
                    margin: 'auto',
                    textAlign: 'center',
                    verticalAlign: 'middle'
                  }}
                >
                  {!allMetrics ? (
                    <Typography>No Metrics</Typography>
                  ) : (
                    <div>
                      <CircularProgress />
                      <Typography>Metrics Loading...</Typography>
                    </div>
                  )}
                </div>
              ) : (
                ''
              )}
              <Table className={classes.table}>
                <TableHead>
                  <TableRow>
                    <CustomTableCell>Concepts</CustomTableCell>
                    <CustomTableCell>ConceptIDs</CustomTableCell>
                    <CustomTableCell>Verification Videos</CustomTableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <CustomTableCell align="right">
                      {selectedModel.concepts.join(', ')}
                    </CustomTableCell>
                    <CustomTableCell align="right">
                      {selectedModel.conceptsid.toString()}
                    </CustomTableCell>
                    <CustomTableCell>
                      {selectedModel.verificationvideos
                        ? selectedModel.verificationvideos.toString()
                        : 'NON'}
                    </CustomTableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>
          </Dialog>
        )}
      </div>
    );
  }
}

export default withStyles(styles)(Models);
