import os

from flask import Flask, render_template, request, redirect, session
from flask_socketio import SocketIO, emit

from helpers import correctString, correctDict

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
socketio = SocketIO(app)

# global variables
users = []
rooms = [
  {
    "name": "izba",
    "public": True,
    "messages": [
      {"content": 'Hello, everyone!', "user": 'mozz', "timestamp": '25 Jan 21:44'},
      {"content": 'Hi, there!', "user": 'gooy', "timestamp": '25 Jan 21:44'},
      {"content": 'Ahoy!', "user": 'ava', "timestamp": '25 Jan 21:44'},
    ]
  },

  { 
    "name": "smikna",
    "public": True,
    "messages": [
      {"content": 'popopopopo', "user": 'gooy', "timestamp": '25 Jan 21:44'},
      {"content": 'oioioioio', "user": 'mozz', "timestamp": '25 Jan 21:44'},
    ]
  },

  {
    "name": "spalna",
    "public": True,
    "messages": [
      {"content": 'qqqq', "user": 'mozz', "timestamp": '25 Jan 21:44'},
      {"content": 'wwwww', "user": 'gooy', "timestamp": '25 Jan 21:44'},
      {"content": 'eeee', "user": 'ava', "timestamp": '25 Jan 21:44'},
    ]
  },

  {
    "name": "kuchyna",
    "public": False,
    "members": ["mozz", "gooy"],
    "messages": [
      {"content": "servus gooy!", "user": "mozz", "timestamp": "25 Jan 21:44"},
    ]
  },
]

# NOTE: all strings incoming form the FE are 'corrected' with correctString() 
# and correctDict() helper functions to avoid issues with non-english characters (čďľňšťžáäéíóúô)

@app.route("/")
def index(): 
  return render_template('index.html')

# USER
@socketio.on('remember user')
def rememberUser(displayname):
  displayname = correctString(displayname)
  if displayname not in users:
    users.append(displayname)
    return 

@socketio.on('check user') 
# check if submitted user name is available
def checkUser(displayname):
  displayname = correctString(displayname)
  
  res = {
      'status': False, # name is not on disposal
      'displayname': displayname,
    }

  if displayname not in users:
   res['status'] = True 

  return emit('serve check user', res, broadcast=False)

@socketio.on('add user')
# the displayname comes automatically after being checked with checkUser()
def addUser(displayname):
  if displayname is None:
    return print('submitted username is None.')
  
  displayname = correctString(displayname)
  if displayname not in users:
    users.append(displayname)
    return emit('serve added user', {'displayname': displayname, 'users': users}, broadcast=False)

@socketio.on('logout user')
def logoutUser(displayname):
  displayname = correctString(displayname)
  if displayname in users:
    users.remove(displayname)
    return emit('serve logout user')

# ROOMS
@socketio.on('get public rooms')
def getPublicRooms():
  listOfPublicRooms = []
  for room in rooms:
    if room["public"] == True:
      listOfPublicRooms.append(room["name"])
  return emit('serve rooms', {"rooms": listOfPublicRooms, "type": "public"}, broadcast=False)

@socketio.on('get private rooms')
def getPrivateRooms(user):
  listOfPrivateRooms = []
  for room in rooms:
    if (room["public"] == False) and (user in room["members"]):
      listOfPrivateRooms.append(room["name"])
  return emit('serve rooms', {"rooms": listOfPrivateRooms, "type": "private"}, broadcast=False)

@socketio.on('create room')
def createRoom(data):
  # data == {name: newRoom, public: True/False, user: author/first member for a private room}

  # sanitize strings from client in case of non-english chars
  data = correctDict(data)

  # check if such room name is available
  roomsList = []
  for room in rooms:
    if room["name"] == data["name"]:
      roomsList.append(room["name"])
  
  # if available, create room
  if data["name"] not in roomsList:
    newRoom = {
      "name": data["name"],
      "public": data["public"],
      "members": [],
      "messages": [],
    }
    
    # if the room is private, add the creator user as the first member 
    if data["public"] == False:
      newRoom["members"].append(data["user"])
    
    # finally, append the room to the global var of rooms 
    rooms.append(newRoom)

    # send response data to FE - all but messages
    responseRoom = newRoom.copy()
    responseRoom.pop("messages") 

    # broadcast depends on the Public property of the room - it will appear in the user's 
    # private chatrooms list only if the user is also a member
    emit('serve new room', responseRoom, broadcast=data['public'])
    return emit('serve open room', (newRoom['messages'], newRoom['members']), broadcast=False)

  # if such room name is already taken
  return emit('serve new room fail', broadcast=False)

@socketio.on('open room')
def openRoom(data):
  data = correctDict(data)
  theRoom = {}
  messages = []
  members = [] # only for private rooms

  # first find the room by its name and then, if it's private, check if the user is its member
  for room in rooms:
    if room['name'] == data['room']:
      if room['public'] == True:
        theRoom = room
        break
      else:
        if data['user'] in room['members']:
          theRoom = room
          members = room['members']
          break

  messages = theRoom['messages']
  return emit('serve open room', (messages, members), broadcast=False)

@socketio.on('add member')
# adding a member to a private room
def addMember(data):
  data = correctDict(data)
  theRoom = {}

  for room in rooms:
    if room['name'] == data['room']:
      theRoom = room
      break

  if data['user'] not in theRoom['members']:
    theRoom['members'].append(data['user'])
    return emit('serve add member', (theRoom['name'], theRoom['members']), broadcast=True)

# MESSAGES
@socketio.on('new message')
def newMessage(msg):
  msg = correctDict(msg)
  message = {
    'content': msg['content'],
    'user': msg['user'],
    'timestamp': msg['timestamp']
  }

  for room in rooms:

    # find the correct room and append the new message. 
    if room["name"] == msg['room']:
      room['messages'].append(message)

      # only store 100 messages per room
      if len(room['messages']) > 100:
        room['messages'].pop(0)
      break

  return emit('serve new message', msg, broadcast=True)