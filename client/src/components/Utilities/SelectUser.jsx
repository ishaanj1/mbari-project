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
    maxHeight: '280px',
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
    const users = await getUsers();

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
            variant="contained"
            onClick={() => {
              handleSelectAll(users, value, 'selectedUsers');
            }}
          >
            Select All
          </Button>
          <Button
            className={classes.button}
            variant="contained"
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
                control={
                  <Checkbox
                    labelStyle={{ color: 'white' }}
                    iconStyle={{ fill: 'white' }}
                  />
                }
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
