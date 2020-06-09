# fľak

This is my solution of the cs50w project 2 - Flask. https://docs.cs50.net/web/2020/x/projects/2/project2.html

Screencast: https://youtu.be/k5cRnstjupw

Description: a lightweight chat app, where you can chat in separate rooms.

Usage: Join in with a unique username (no real log in, no password) and chat in one of the public rooms with anyone or in private rooms with only selected users (members). 
Create new public and private rooms and add members to the private ones, if you are already a member. 
New messages, chatrooms and relevant info on members is automatically updated to you (and other users) thanks to websockets.
If you close the window without "logging out", the broswer will remember you and open the last visited chatroom.

Tech: Python + Flask (flask_socketio), Javascript + jQuery, HTML, SASS, Bootstrap