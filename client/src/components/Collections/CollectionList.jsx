import React, { Component } from "react";
import PropTypes from "prop-types";
import Button from "@material-ui/core/Button";
import Drawer from "@material-ui/core/Drawer";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import { withStyles } from "@material-ui/core/styles";

import IconButton from "@material-ui/core/IconButton";
import DeleteIcon from "@material-ui/icons/Delete";
import GeneralMenu from "../Utilities/GeneralMenu";

const styles = theme => ({
  drawer: {
    width: "550px",
    overflow: "auto"
  },
  toggleButton: {
    marginTop: "5px",
    float: "right"
  },
  createButton: {
    marginTop: "10px",
    marginLeft: "20px"
  },  
  addButton: {
    float: "right",
    marginTop: "10px",
    marginLeft: "20px"
  },
});

class VideoList extends Component {
  constructor(props) {
    super(props);
    this.state = {
      CollectionOpen: false
    };
  }

  toggle = list => {
    this.props.loadCollections();
    this.setState({
      [list]: !this.state[list]
    });
  };

  handleNewCollectionModal = () => {
    this.toggle("CollectionOpen");
    this.props.handleCreateCollection();
  } 

  handleDeleteCollectionModal = id => {
    this.toggle("CollectionOpen");
    this.props.deleteCollection(id)
  } 

  handleInsert = id => {
    this.toggle("CollectionOpen");
    this.props.insertToCollection(id, [this.props.openedVideo.id])
  }

  // openVideoSummary = async (event, video) => {
  //   event.stopPropagation();

  //   this.setState({
  //     descriptionOpen: true,
  //     summary: await this.getSummary(video)
  //   });
  // };

  // closeVideoSummary = () => {
  //   this.setState({
  //     descriptionOpen: false,
  //     summary: null
  //   });
  // };

  // getSummary = async video => {
  //   const config = {
  //     headers: {
  //       "Content-Type": "application/json",
  //       Authorization: "Bearer " + localStorage.getItem("token")
  //     }
  //   };
  //   try {
  //     var summary = await axios.get(
  //       "/api/aivideos/summary/" + video.name,
  //       config
  //     );

  //     if (summary) {
  //       return summary;
  //     }
  //   } catch (error) {
  //     console.log("Error in summary.jsx get /api/aivideos/summary");
  //     console.log(error.response.data);
  //   }
  // };

  // //Methods for video meta data
  // openVideoMetadata = (event, video) => {
  //   event.stopPropagation();
  //   this.setState({
  //     openedVideo: video
  //   });
  // };

  // closeVideoMetadata = () => {
  //   this.setState({
  //     openedVideo: null
  //   });
  // };

  render() {
    const { classes, data } = this.props;

    console.log(data);

    return (
      <div className={classes.root}>
        <Button
          className={classes.toggleButton}
          variant="contained"
          color="primary"
          onClick={() => this.toggle("CollectionOpen")}
        >
          Toggle {this.props.collType} Collection List
        </Button>

        <Drawer
          anchor="right"
          open={this.state.CollectionOpen}
          onClose={() => this.toggle("CollectionOpen")}
        >
          <div className={classes.drawer}>
            <div className={classes.addButton}>
              <GeneralMenu
                name={"Add opened video to collection"}
                variant="contained"
                color="primary"
                handleInsert={this.handleInsert}
                Link={false}
                items={
                  this.props.data
                }
              />
            </div>
            <Button
              className={classes.createButton}
              variant="contained"
              color="primary"
              onClick={() => this.handleNewCollectionModal()}
            >
              Create New Collection
            </Button>
            <List component="div" disablePadding>
              {data.map(collection => (
                <ListItem
                  key={collection.id}
                >
                  <ListItemText primary={collection.id + ". " + collection.name} 
                    secondary={collection.videos.join(" , ")}
                  />
                  <IconButton aria-label="Delete">
                    <DeleteIcon onClick={() => this.handleDeleteCollectionModal(collection.id)} />
                  </IconButton>
                </ListItem>
              ))}
            </List>
          </div>
        </Drawer>
      </div>
    );
  }
}

VideoList.propTypes = {
  classes: PropTypes.object.isRequired
};

export default withStyles(styles)(VideoList);