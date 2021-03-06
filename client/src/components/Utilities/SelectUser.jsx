import React from 'react';
import { withStyles } from '@material-ui/core/styles';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';
import FormGroup from '@material-ui/core/FormGroup';
import { Checkbox, Button } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';

const styles = theme => ({
  formControl: {
    marginTop: theme.spacing(1.5),
    maxHeight: '300px',
    overflow: 'auto'
  },
  group: {
    marginLeft: 15
  },
  button: {
    marginTop: theme.spacing(2),
    marginLeft: theme.spacing()
  }
});

class SelectUser extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      users: []
    };
  }

  componentDidMount = async () => {
    const { getUsers, selectUser } = this.props;
    let users = await getUsers();
    // users = users.filter(
    //   user => config.client.annotator_users.indexOf(user.id) >= 0
    // );

    this.setState({
      users
    });

    if (
      users.some(user => user.id.toString() === localStorage.getItem('userid'))
    ) {
      selectUser(localStorage.getItem('userid'));
    }
  };

  render() {
    const {
      classes,
      value,
      handleChangeList,
      handleSelectAll,
      handleUnselectAll
    } = this.props;
    const { users } = this.state;

    return (
      <>
        <Typography>Select users</Typography>
        <div>
          <Button
            className={classes.button}
            color="secondary"
            onClick={() => {
              handleSelectAll(users, value, 'selectedUsers');
            }}
          >
            Select All
          </Button>
          <Button
            className={classes.button}
            color="secondary"
            onClick={() => {
              handleUnselectAll('selectedUsers');
            }}
          >
            Unselect All
          </Button>
        </div>
        <FormControl component="fieldset" className={classes.formControl}>
          <FormGroup
            name="user"
            className={classes.group}
            value={value}
            onChange={handleChangeList}
          >
            {users.map(user => (
              <FormControlLabel
                key={user.id}
                value={user.id.toString()}
                control={<Checkbox color="secondary" />}
                label={user.username}
                checked={value.includes(user.id.toString())}
              />
            ))}
          </FormGroup>
        </FormControl>
      </>
    );
  }
}

export default withStyles(styles)(SelectUser);
