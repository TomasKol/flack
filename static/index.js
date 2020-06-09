// STRUCTURE OF THIS CODE:
// 1. SOCKET - ON CONNECTION
// 2. ADDING 'UNIVERSAL' EVENT LISTENERS (to elements that are not created dynamically)
// 3. SOCKETS - USERS
// 4. SOCKETS - ROOMS
// 5. SOCKETS - MESSAGES
// 6. HELPER FUNCTIONS

document.addEventListener('DOMContentLoaded', () => {
  $('#chatroom').hide();
  
  const socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);
  
  // "global" var
  let displayname = '';
  

  // ON CONNECTION
  socket.on('connect', () => {
    $('#create-room-form').hide();
    $('#send-message').hide(); // initial hide; it shows up after opening a room
    
    // handle the display name and the localStorage
    handleDisplayNameAtConnection();

    // if the user is remembered, open the GUI
    if (displayname) {
      openUser(displayname);
    } 

    // open the last visited room
    if (localStorage.getItem('room')) {
      const data = {
        room: localStorage.getItem('room'),
        user: displayname,
      }
      socket.emit('open room', data);
    }

    // ADDING ONCLICK EVENTS

    //the #logging button in navbar handles both log IN and log OUT, depeneding on the situation
    document.querySelector('#logging').onclick = () => {
      if (localStorage.getItem('displayname')) {
        socket.emit('logout user', displayname);
      } else {
        getNewName('Choose your username');
      }
    }

    // showing the 'create room' form
    document.querySelector('#create-room-button').onclick = () => {
      const time = 100;
      $('#create-room-button').fadeOut(time);
      $('#create-room-form').delay(time).fadeIn(time);
      setTimeout(() => {$('#create-room-name').focus()}, time);
      // without the delay, you are trying to give focus before the element is rendered
    }

    // hiding the 'create room' form
    document.querySelector('#create-room-cancel').onclick = () => {
      hideNewRoomForm();
    }

    // 'submitting' the new room to be created
    document.querySelector('#create-room-public').onclick = () => {
      createRoom('public');
    }
    document.querySelector('#create-room-private').onclick = () => {
      createRoom('private');
    }

    // submitting a new message by clicking the 'send' button or pressing Enter
    document.querySelector('#new-message-ok').onclick = () => sendMessage();
    document.querySelector('#new-message-text').addEventListener('keypress', e => {
      if (e.key == 'Enter') sendMessage();
    });
  });


  // USER

  // after trying to log in, the BE send this response
  // if the display name is not available, ask for another
  socket.on('serve check user', res => {
    if (res.status === false) {
      getNewName('Such username is already taken. Choose another.'); 
    } else {
      socket.emit('add user', res.displayname)
    }

  });

  // after successfully adding the new user on the BE (log in), set up the GUI for the user
  socket.on('serve added user', data => {
    displayname = data.displayname;
    localStorage.setItem('displayname', displayname);
    setHeaderText();
    document.querySelector('#logging').innerHTML = 'Log out';
    openUser(displayname);
    $('#send-message').hide(); // initial hide; it shows up after opening a room
  });

  // after logging out the user, clean up the localStorage and GUI
  socket.on('serve logout user', () => {
    localStorage.removeItem('displayname');
    localStorage.removeItem('room');
    displayname = null;

    // empty all important elements before hiding the #chatroom, so the data won't stay in dev tools.
    document.querySelector('#chatroom-list-public').innerHTML = '';
    document.querySelector('#chatroom-list-private').innerHTML = '';
    document.querySelector('#messages').innerHTML = '';
    $('#chatroom').hide();

    // update the navbar
    document.querySelector('#display-id').innerHTML = 'Log in and start chatting!';
    document.querySelector('#logging').innerHTML = 'Log in';
  });


  // ROOMS

  // after connection/login, show the available rooms
  socket.on('serve rooms', data => {
    document.querySelector(`#chatroom-list-${data.type}`).innerHTML = '';
    for (let i in data.rooms) {
      appendRoom(data.rooms[i], data.type);
    }  
  });

  // after creating a new room, append it to the list of rooms
  socket.on('serve new room', newRoom => {
    appendRoom(newRoom.name, newRoom.public == false ? 'private' : 'public');
  });

  // create room fail - alert that such room already exists
  socket.on('serve new room fail', () => {
    alert('Such room already exists. Try another room name.');
  });

  // open room after clicking its name in the list and load the messages
  socket.on('serve open room', (messages, members) => {
    // BE returns [list of messages]

    // enable writing a new message and focus on (emptied) text input
    $('#send-message').show();
    $('#new-message-text').val('').focus();

    // if the remembered room no longer exists (app restart deletes user-created rooms, while the browser still remembers) 
    if (messages === false) {
      localStorage.removeItem('room');
    } 

    // display the messages
    $('#messages').empty();
    for (let i in messages) {
      const messageBody = generateMessageBody(messages[i]);
      $('#messages').append(messageBody);
    }
    scrollToBottom('#messages');

    // update the header line with list of members of a private room
    setHeaderText(members);
  });

  // after adding a new member to a private room, refresh the list of rooms and update the header
  socket.on('serve add member', (room) => {
    socket.emit('get private rooms', displayname);
    
    // re-open the room so the list of members in the header is updated
    if (localStorage.getItem('room') == room) {
      const data = {
        user: displayname,
        room: room,
      }
      socket.emit('open room', data);
    }
  });


  //MESSAGES

  // display the new message and auto-scroll to the bottom, so it is visible
  socket.on('serve new message', data => {
    if (data.room == localStorage.getItem('room')) {
      const messageBody = generateMessageBody(data);
      $('#messages').append(messageBody);
      scrollToBottom('#messages');
    }
  });


  // HELPERS

  // handle display name at page load
  function handleDisplayNameAtConnection() {

    // if a user is remembered by the browser, remind the BE about it (might be deleted because of server restart)
    if (localStorage.getItem('displayname')) { 
      displayname = localStorage.getItem('displayname');
      socket.emit('remember user', displayname);
      
      setHeaderText();
      document.querySelector('#logging').innerHTML = 'Log out';
    
    // else we have no user remembered -> go to log in.
    } else { 
      document.querySelector('#display-id').innerHTML = 'Log in and start chatting!';
      document.querySelector('#logging').innerHTML = 'Log in';
    }
  }

  //prompt for new display name and proceed to logging in
  function getNewName(label) {
    let newName = prompt(label);

    // if the user doesn't cooperate, do nothing
    if (newName === null || newName === '') return;

    // check if the desired name is available
    socket.emit('check user', newName); // -> returns True for free name or False for taken name
  }

  // open the GUI for the user with the right chatrooms
  function openUser(name) {
      socket.emit('get public rooms');
      socket.emit('get private rooms', name);
      $('#chatroom').show();
  }

  // update the sentence on the navbar based on the situation
  function setHeaderText(members) {

    // members == members of a private room. if no such arg is passed in, it is logging in / coming back
    let button = '';
    if (!members) {
      document.querySelector('#display-id').innerHTML = `
        Welcome, <b>${displayname}</b>. 
        Choose a room and start chatting.
      `;
      return;

    // prepare data for private room
    } else if (members.length > 0) {
      members = `(${members.join(', ')})`;
      button = '<a id="add-member">Add member</a>';

    // prepare data fot public room
    } else {
      members = '(public room)';
    }

    // prepare the sentence
    let text = `
      Chatting as <b>${displayname}</b> 
      in <b>${localStorage.getItem('room')}</b> 
      ${members}.
      ${button}
    `;

    // finally, update the header
    document.querySelector('#display-id').innerHTML = text;

    // update the 'add member' link to point to the correct private room
    $('#add-member').off().on('click', () => {
      addMember(localStorage.getItem('room'));
    });
  }
  
  // adding rooms to the list in the left panel and adding them event listeners to open the rooms
  function appendRoom(roomName, type) {

    $(`#chatroom-list-${type}`).append(`<li id="room-${roomName}" class="link">${roomName}</li>`);

    document.querySelector(`#room-${roomName}`).onclick = () => {
      localStorage.setItem('room', roomName);
      console.log('updated localstorage room: ', roomName, localStorage.getItem('room'));
      const data = {
        user: displayname,
        room: roomName,
      }
      socket.emit('open room', data);
    }
  }

  // hiding the 'create new room' form after submitting or cancelling submission
  function hideNewRoomForm() {
    const time = 100;
      $('#create-room-form').fadeOut(time);
      $('#create-room-button').delay(time).fadeIn(time);
      $('#create-room-name').val('');
  }

  // handle new room creation. onclick buttons (#create-room-public, #create-room-private)
  function createRoom(type) {
    const roomName = document.querySelector('#create-room-name').value;

    // no reaction to no room name 
    if (!roomName) return;
    
    type = type == 'public' ? true : false;
    socket.emit('create room', {name: roomName, public: type, user: displayname});
    document.querySelector('#create-room-name').value = '';
    hideNewRoomForm();

    // after creation of the room, the BE will also open it with 'serve open room', 
    // so set the localStorage now, so it won't mess the other users' 
    localStorage.setItem('room', roomName);
  }

  // adding member to a private room
  function addMember(toRoom) {
    const newMember = prompt("Whom do you want to add to this room?");
    if (!newMember) {
      return;
    } else {
      socket.emit('add member', {user: newMember, room: toRoom});
    }
  }

  // handle submission of a new message and send it to BE
  function sendMessage() {
    if (!document.querySelector('#new-message-text').value) {
      return;
    }

    // prepare the timestamp
    let time = (new Date()).toTimeString().slice(0,5);
    let date = (new Date()).toDateString();
    date = date.slice(8,10) + '  ' + date.slice(4,7);

    // prepare the data
    const msg = {
      room: localStorage.getItem('room'),
      content: $('#new-message-text').val(),
      user: displayname,
      timestamp: date + ' ' + time
    }

    socket.emit('new message', msg);
    document.querySelector('#new-message-text').value = '';
  }

  // generating messages from BE to be shown in the message board
  function generateMessageBody(data) {

    // distinguish between current user's own messages and messages of other users
    let specialClass = 'others-message';
    if (data.user == displayname) {
      specialClass = 'my-message';
    }

    //create html code of the message
    const messageBody = `
      <div class="${specialClass}" >
        <div class="message-header">
          <span class="message-user">${data.user}</span> 
          <span class="message-timestamp">${data.timestamp}</span> 
        </div>
        <p class="message-content">${data.content}</p>
      </div>
    `
    return messageBody;
  }

  function scrollToBottom(id) {
    $(id).scrollTop(500000);
  }
});