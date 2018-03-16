<p align="center">
  <img src="https://www.cisl.cam.ac.uk/business-action/natural-capital/natural-capital-impact-group/doing-business-with-nature/images/water-icon.png"/>
</p>

# Enpuddle

<table>
<tr>
<td>
  With Enpuddle you can create a private cloud service to store all your data. Access and manage your data with an Android application and recieve notifications when folders you subscribe to are modified.
</td>
</tr>
</table>

## Usage

* Download as zip or clone the repo.
* Locate the zipped executable for your system in the dist folder.
* Unzip the file.
* Setup the required configuration in enpuddle.cfg (See Config).
* Start your local or remote database.
* Run the server executable.
* Access your private cloud using the Android application.

### Config

The configuration for the server is specified in enpuddle.cfg, which should be located in the same directory as your executable. The configuration is in JSON format.  

#### Database (Required)
* **encryption_password:** Safe encryption password for database. _(mypass)_
* **database:** Database name. _(db)_
* **user:** Database user. _(root)_
* **password:** User password. _(password)_
* **host:** Database host. _(localhost)_
* **dialect:** Database dialect, supported: mysql/postgres. _(mysql)_

#### Server (Recommended)
* **port:** The port your server will run on, make sure it is forwarded. _(8080)_

#### Storage
* **total_limit:** Max disk space server storage will use, in MB. _(5000)_
* **user_limit:** Max disk space each user can use. _(500)_
* **base_dir:** Path relative to executable, where puddles are stored. _(puddles/)_
* **avatar_dir:** Path relative to executable, where avatars are stored. _(avatars/)_

## HTTP API

The server API is available on:  
https://documenter.getpostman.com/view/3860887/RVnVDew7

## Socket.io

[Socket.io](https://socket.io/docs/) is used to supply real time updates when things changes on the server.

### Client usage
**Connect:**  
Specify a valid refresh token in the socket.io 
[connection query params](https://socket.io/docs/client-api/#with-query-parameters).

`query: {auth_token: refresh_token}`

**Observe**  
Observe any updates on the specified path. Many paths can be observed at once.

`socket.emit('observe', 'path');`

**Unobserve**  
Stop recieving updates relevant to path.

`socket.emit('unobserve', 'path');`

**Observe Subscription**  
It is recommended the client runs this once for every path it is subscribed to when establishing a connection. The server handles observations of new subscriptions.

`socket.emit('observe_sub', 'path');`

<hr>

### Server Events
When the client is connected and observes a path, events relevant to that path may be recieved.

**Redefined**  
The "redefined" event triggers when a path is changed to a new path. For example, when a file or directory is renamed or moved. This allows the client to redirect to the new path when recieving this event.

`param: {path: path, new_path: new_path}`

**Modified**  
The "modified" event triggers when the contents of a directory is changed. This allows the client to refresh displayed contents.

`param: {path: path}`

**Deleted**  
The "deleted" event triggers when the path is deleted. This allows the client to close the drop which is deleted.

`param: {path: path}`

**Permission Added/Deleted**  
The "perm_added/deleted" event triggers when a permission is added/deleted to the path. This allows the client  to do relevant updates to the interface.

`param: {path: path, uid: uid, permission: permission}`

**Sharing Modified**  
The "sharing_modified" event triggers when a permission to the user is modified in a shared folder. This allows the client to do refresh shared with me folders.

`param: {path: path}`

**Subscription Notice**  
The "sub_notice" event triggers whenever something happens to a path the user is subscribed to. This allows the client to display the relevant message (notification on mobile)

`param: {message: message}`

**Added/Deleted Subscription**  
The "added/deleted_sub" event triggers whenever the user subscribes to a path from another client. This allows the client to update any displayed sub listings or display a message/notification.

## License
<a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/">Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License</a>.