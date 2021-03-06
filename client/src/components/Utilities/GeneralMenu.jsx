import React from 'react';
import Button from '@material-ui/core/Button';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import OndemandVideo from '@material-ui/icons/OndemandVideo';
import IconButton from '@material-ui/core/IconButton';

const GeneralMenu = props => {
  const { disabled, buttonid, name, Link, items, aivideos } = props;
  let { color, variant } = props;
  const [anchorEl, setAnchorEl] = React.useState(null);
  color = color || 'inherit';
  variant = variant || 'text';

  function handleClick(event) {
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function handleInsert(id, videos) {
    handleClose();
    props.handleInsert(id, videos);
  }
  return (
    <span>
      {aivideos ? (
        <IconButton
          onClick={handleClick}
          aria-label="Ai Videos"
          disabled={!items}
        >
          <OndemandVideo />
        </IconButton>
      ) : (
        <Button
          id={buttonid}
          variant={variant}
          color={color}
          onClick={handleClick}
          disabled={disabled}
        >
          {name}
        </Button>
      )}
      <Menu
        id="simple-menu"
        style={{ top: '30px' }}
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
      >
        {items && items.length > 0 && items[0]
          ? Link
            ? items.map(item => (
                <MenuItem
                  id={item.id}
                  key={item.name}
                  component={props.Link}
                  to={item.link}
                  onClick={() => handleClose()}
                >
                  {item.name}
                </MenuItem>
              ))
            : items.map(item => (
                <MenuItem
                  key={aivideos ? item : item.name}
                  onClick={
                    aivideos
                      ? () => handleInsert(item, items)
                      : () => handleInsert(item.id)
                  }
                >
                  {!aivideos ? `${item.id} ${item.name}` : `${item}`}
                </MenuItem>
              ))
          : ''}
      </Menu>
    </span>
  );
};

export default GeneralMenu;
