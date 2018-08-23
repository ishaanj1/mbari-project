import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import ListItem from '@material-ui/core/ListItem';

const styles = theme => ({
  item: {
    paddingTop: 0,
    width: '1280px',
    height: '720px',
    paddingLeft: 0
  },
  img: {
    width: '1280px',
    height: '720px',
  }
});

class AnnotationFrame extends Component {
  constructor(props) {
    super(props);
    this.state = {
      image: null,
      isLoaded: false,
      error: null,
      width: null,
      height: null,
    };
  }

  getVideoImage = (path, secs, callback) => {
    var me = this;
    var video = document.createElement('video');
    video.setAttribute('crossOrigin', 'use-credentials');
    video.onloadedmetadata = function() {
      // this.currentTime = Math.min(Math.max(0, (secs < 0 ? this.duration : 0) + secs), this.duration);
      this.currentTime = secs;
    };
    video.onseeked = function(e) {
      var canvas = document.createElement('canvas');
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      var img = new Image();
      img.setAttribute('crossOrigin', 'use-credentials');
      img.src = canvas.toDataURL();
      callback.call(me, img, this.currentTime, e);
    };
    video.onerror = function(e) {
      callback.call(me, undefined, undefined, e);
    };
    video.src = path;
  }

  componentDidMount = async () => {
    this.getVideoImage('https://d1yenv1ac8fa55.cloudfront.net/videos/'+this.props.annotation.filename,
      this.props.annotation.timeinvideo, (img, secs, event) => {
        if (event.type === 'seeked') {
          this.setState({
            isLoaded: true,
            image: img,
          });
        }
      }
    );
  };

  render () {
    const { error, isLoaded, image } = this.state;
    const { classes } = this.props;
    if (!isLoaded) {
      return <div>Loading...</div>;
    }
    if (error)  {
      return <div>Error: {error.message}</div>;
    }
    return (
      <React.Fragment>
        <ListItem className={classes.item}>
          <div id='test'></div>
          <img className={classes.img} id='imageId' src={image.src} alt='error' />
          <div style={{
            position: 'absolute',
            top: (this.props.annotation.y1)+'px',
            left: (this.props.annotation.x1)+'px',
            height: (this.props.annotation.y2-this.props.annotation.y1) + 'px',
            width: (this.props.annotation.x2-this.props.annotation.x1) +'px',
            borderStyle: 'solid',
            borderWidth: '2px',
            borderColor: 'coral',
          }}>
          </div>
        </ListItem>
      </React.Fragment>
    );
  }
}

AnnotationFrame.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(AnnotationFrame);