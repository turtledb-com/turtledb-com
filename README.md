# turtledb-com
At their most basic, applications must be able to display, persist, and share user-generated data.

**The Problem:** Setting up and maintaing the technologies required to satisfy these requirements is prohibitively expensive for a casual human user.

**The Solution:** By limiting the applications to human-scale usage we are able treat all the data an app-user ever creates as a single database entry.
This significantly reduces the complexities and costs associated with making an application.
> I'm assuming human-scale usage to be around 2MB.
> The average human typing speed is 40 WPM. 
> 2MB of typed data would take 175 hours to generate. 

This project handles displaying, persisting, and sharing a human-scale amount of data without being prohibitively expensive.

The primary inspirations for this project are bittorrent, bitcoin, git, and the w3c. 



## THIS PROJECT IS A WORK IN PROGRESS



## Overview

A `Turtle` in this project is an object that holds the entire collection of an app-user's data encoded as an array of bytes.
A `new Turtle` can be created using an existing `Turtle` and appending any changes to that `Turtle`.
Because a `Turtle` is an ongoing sequence of byte-arrays, every `Turtle` is a stream.
This makes them a cheap, easy, and standardized to deal with.

> The name "Turtle" is a reference to the "Turtles All the Way Down" idiom. 


turtledb-com is version control, transfer protocol, and a service. 
It uses a light-weight display framework (optional) to simplify data rendering.

### turtledb-com is version control

After being streamed, a `Turtle` can be decoded to a JavaScript value. 
For streamed changes to be accepted they must end with a signed `Commit` value.
Streamed changes without a valid signature are rejected.
The committed value can be anything but it's recommended you use an object with `timestamp`, `message`, and `state` fields.

### turtledb-com is a transfer protocol

A `Turtle` is a sequence of *changed data*.
*Changed data* is a byte array.
`Turtle`s can be synced just by sending any missing byte arrays.
As the `Turtle` grows so does the dictionary of reusable values.
As the dictionary grows, the efficiency of the protocol increases.

### turtledb-com is a service provider
turtledb-com as a service provides a file-system for virtual computers described in JavaScript, HTML, and CSS.

turtledb.com is the built-in service provider designed to handle realistic-levels of human-scale usage for free.


## Usage example

1. point Chrome to [turtledb.com](https://turtledb.com)
1. [open developer tools console](https://developer.chrome.com/docs/devtools/open#shortcuts)
1. create a `Signer`
    * ```
      mySigner = new Signer('your name', 'your unique password')
      ```
    * you don't have to register a user to make a `Signer`, just use any unique combination
1. checkout a new `TurtlePointer`
    * ```
      myRepo = globalPeer.checkout(mySigner, 'name of the repo')
      console.log(myRepo.name)
      // '42f8jho4f...'
      await myRepo.ready
      ```
    * once the `await` resolves the repo should be ready to `Commit` to
1. `Commit` some data
    * ```
      myWorkspace = new Workspace(myRepo)
      myWorkspace.commit({
        timestamp: new Date(),
        message: 'test commit',
        state: {
          a: 1,
          b: 'foo'
        }
      })
      await myWorkspace.ready
      ```
1. on another machine, point Chrome to [turtledb.com](https://turtledb.com),
[open developer tools console](https://developer.chrome.com/docs/devtools/open#shortcuts),
sign in and retrieve your data by name
    * ```
      mySigner = new Signer('your name', 'your unique password')
      myRepo = globalPeer.checkout(mySigner, 'name of the repo')
      await myRepo.ready
      console.log(myRepo.lookup('value', 'state'))
      // {a: 1, b: 'foo'}
      ```
1. on another machine, point Chrome to [turtledb.com](https://turtledb.com),
[open developer tools console](https://developer.chrome.com/docs/devtools/open#shortcuts),
retrieve your data by compact public key
    * ```
      myRepo = globalPeer.getBranch('42f8jho4f...')
      await myRepo.ready
      console.log(myRepo.lookup('value', 'state'))
      // {a: 1, b: 'foo'}
      ```

## Deeper dive documentation (TODO)
* Encoding/decoding
* The Recaller
* Uint8ArrayLayerPointer and Committer
* ``` h`` ``` and `render()`
* how the start page works

### What's running on the server
- The server is a digital ocean droplet running ubuntu.
- [node 22](https://joshtronic.com/2024/05/26/ubuntu-nodejs-22-install/)
- yarn and PM2 installed globally
- [nginx and certbot](https://www.digitalocean.com/community/tutorials/how-to-secure-nginx-with-let-s-encrypt-on-ubuntu-20-04)
- [the turtledb-com repo](https://github.com/turtledb-com/turtledb-com)
