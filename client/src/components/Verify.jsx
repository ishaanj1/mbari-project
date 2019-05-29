import React, { Component } from "react";
import axios from "axios";
import PropTypes from "prop-types";
import { withStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";

import VerifySelection from "./VerifySelection.jsx";
import VerifyAnnotations from "./VerifyAnnotations.jsx";

const styles = theme => ({
  root: {
    width: "90%"
  },
  button: {
    margin: theme.spacing.unit
  },
  resetContainer: {
    padding: theme.spacing.unit * 3
  },
  list: {
    width: "100%",
    backgroundColor: theme.palette.background.paper
  },
  item: {
    display: "inline",
    paddingTop: 0,
    width: "1300px",
    height: "730px",
    paddingLeft: 0
  },
  img: {
    padding: theme.spacing.unit * 3,
    width: "1280px",
    height: "720px"
  },
  container: {
    display: "grid",
    gridTemplateColumns: "repeat(12, 1fr)",
    gridGap: `${theme.spacing.unit * 3}px`
  },
  paper: {
    padding: theme.spacing.unit * 5
  }
});

class Verify extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selectionMounted: true,
      selectedUsers: ["-2"],
      selectedVideos: ["-2"],
      selectedConcepts: ["-2"],
      annotations: [],
      error: null,
      index: 0
    };
  }

  toggleSelection = async () => {
    let annotations = [];
    if (!this.state.selectionMounted) {
      this.resetState();
    } else {
      annotations = await this.getAnnotations();
    }
    this.setState({
      annotations: annotations,
      selectionMounted: !this.state.selectionMounted
    });
  };

  getUsers = async () => {
    return axios
      .get(`/api/users`, {
        headers: { Authorization: "Bearer " + localStorage.getItem("token") }
      })
      .then(res => res.data)
      .catch(error => {
        this.setState({
          error: error
        });
      });
  };

  getVideos = async () => {
    return axios
      .get(`/api/unverifiedVideosByUser/`, {
        headers: { Authorization: "Bearer " + localStorage.getItem("token") },
        params: {
          selectedUsers: this.state.selectedUsers
        }
      })
      .then(res => res.data)
      .catch(error => {
        this.setState({
          error: error
        });
      });
  };

  getConcepts = async () => {
    return axios
      .get(`/api/unverifiedConceptsByUserVideo/`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token")
        },
        params: {
          selectedUsers: this.state.selectedUsers,
          selectedVideos: this.state.selectedVideos
        }
      })
      .then(res => res.data)
      .catch(error => {
        this.setState({
          error: error
        });
      });
  };

  getAnnotations = async () => {
    return axios
      .get(`/api/unverifiedAnnotationsByUserVideoConcept/`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token")
        },
        params: {
          selectedUsers: this.state.selectedUsers,
          selectedVideos: this.state.selectedVideos,
          selectedConcepts: this.state.selectedConcepts
        }
      })
      .then(res => res.data)
      .catch(error => {
        this.setState({
          error: error
        });
      });
  };

  handleChange = type => event => {
    if (!this.state[type].includes(event.target.value)) {
      if (event.target.value === "-2") {
        this.setState({
          [type]: ["-2"]
        });
      } else {
        if (this.state[type].length === 1 && this.state[type][0] === "-2") {
          this.setState({
            [type]: [event.target.value]
          });
        } else {
          this.setState({
            [type]: this.state[type].concat(event.target.value)
          });
        }
      }
    } else {
      this.setState({
        [type]: this.state[type].filter(typeid => typeid !== event.target.value)
      });
    }
  };

  resetState = () => {
    this.setState({
      selectedUsers: ["-2"],
      selectedVideos: ["-2"],
      selectedConcepts: ["-2"],
      index: 0
    });
  };

  handleNext = callback => {
    this.setState(
      {
        index: this.state.index + 1
      },
      callback
    );
  };

  render() {
    let selection = "";
    if (this.state.selectionMounted) {
      selection = (
        <VerifySelection
          selectedUsers={this.state.selectedUsers}
          selectedVideos={this.state.selectedVideos}
          selectedConcepts={this.state.selectedConcepts}
          getUsers={this.getUsers}
          getVideos={this.getVideos}
          getConcepts={this.getConcepts}
          handleChange={this.handleChange}
          resetState={this.resetState}
          toggleSelection={this.toggleSelection}
        />
      );
    } else {
      selection = (
        <Paper
          square
          elevation={0}
          className={this.props.classes.resetContainer}
        >
          <VerifyAnnotations
            annotation={this.state.annotations[this.state.index]}
            index={this.state.index}
            handleNext={this.handleNext}
            toggleSelection={this.toggleSelection}
            size={this.state.annotations.length}
          />
        </Paper>
      );
    }

    return <React.Fragment>{selection}</React.Fragment>;
  }
}

Verify.propTypes = {
  classes: PropTypes.object
};

export default withStyles(styles)(Verify);