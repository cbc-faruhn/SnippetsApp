# SnippetsApp

The SnippetsApp is a responsive Web Application allowing to provide a collection of code snippets in different programming or markup languages.

For that it serves a simple UI, snippet life cycle and administration.

# Usage

Listing and contributing snippets doesn't require a user or special access rights.

Administering (reviewing and publishing code snippets) requires a user and two-factor authentication (see installation).

# Installation

SnippetApps runs on nodejs and is prepared to run with Phusion Passenger. For installation, after downloading source simply run:

```
npm install
node app.js --generateUser <your desired admin user name>
node app.js --QRCode <your desired admin user name>
```
Replace ```<your desired admin user name>``` with your desired admin user name, e.g. rudi.reviewer
Viewing the QR Code allows you to add the second factor to your Google Authenticator App.
  
# Configure

Within the config.json file you can find different, to be configured, parameters, like:
+ HTTP port to run on
+ App Title (UI + Notifications)
+ base URL
+ (allowed) languages
+ category groups and categories within these groups
+ DB connection (host, username, password, database)
+ E-Mail sending options (from, to [= receiver of admin notifications], host, port, authentication)
+ allowed admin users (adding is only done via ```node app.js --generateUser <your desired admin user name>```)
