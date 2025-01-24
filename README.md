# turtledb-com

A humanly achievable way to create useful applications for other humans.

> [!NOTE] 
> This document is meant to be academic.
> Links to documents meant for developers are at the end

> [!WARNING] 
> THIS PROJECT IS A WORK IN PROGRESS


## The Problem

Setting up and maintaining the technologies to make a useful application is prohibitively expensive for humans. 
This is because "industry best practices" are made by businesses.
Business applications must scale with world-spanning teams and be able to consume data from billions of users. 

The internet is for humans but applications are for businesses.

## The Solution 

Replace "industry best practices" with a "cheap, easy, and good enough practice"

### Solution Requirements

* The server is fully managed and inexpensive.
* The application is useful.
* Any technologies are standard and easy to learn.

We achieve this by treating each app-instance as a stand-alone unit with human-scale usage.
This way we are able treat all the data an app-instance ever creates as a single database entry.
This strategy *significantly* reduces the complexity and cost of serving an application.
Additionally, when possible, this project uses standard web technologies.

## Definition of Terms

##### Application
For now we aren't handling images, audio, or video (CSS, SVG, and Canvas are fine though). 
Some possible applications with limited media are:

* class notes
* chat
* internet forums
* issue trackers
* personal publications
* grocery lists

##### App-Instance
To be used, an application is copied into a new cryptographically signed instance (`TurtleBranch`). 
Any data or other changes must be signed and added to this instance.

##### Human
The term *human* is used rather than *user*. 
The most important *user* for most apps are marketing departments.
For turtledb-com apps, the most important *user* is the consumer.

##### Human-scale
About 2MB of input data
-- The average human typing speed is 40 WPM. 
2MB of typed data would take 175 hours to input. 

##### `Turtle`
A read-only holder for "all the data an app-instance ever creates" (see more below)

##### `TurtleBranch`
A moveable tag pointing to a `Turtle`. 
An app-instance's uses a `TurtleBranch` to point to the current state of "all the data".

##### Useful 
The term *useful* is meant as a minimum set of features all apps must provide.
An application must be able to display, persist, and share user-generated data.

## A Little More about `Turtle`s

Everything using this project is built on `Turtle`s.
A `Turtle` is an object that holds a dictionary of an app-instance's data encoded as sequential arrays of bytes.
A `new Turtle` can be created by taking an existing `Turtle` and combining it with changes as a new arrays of bytes.
Because a `Turtle` is an ongoing sequence of byte-arrays it's literally a data-stream and can be treated as such.
Because streams can be easily stored, retrieved, shared, and *uh...* streamed, it makes `Turtle`s a cheap, easy, and standard to deal with.

> [!NOTE] 
> Fun Fact: "Turtle" is a reference to ["Turtles All the Way Down"](https://en.wikipedia.org/wiki/Turtles_all_the_way_down)

## Overview

> [!NOTE] 
> The primary inspirations for this project are bittorrent, bitcoin, git, and the w3c. 

### turtledb-com is Version Control

Every version of a `Turtle` ends with a signed `Commit`. 
All previous `Commit`s are included with each new `Turtle`

After being streamed, a `Turtle`'s `Commit` can be decoded to a JavaScript value. 
The committed value can be anything but it's recommended you use an object with `timestamp`, `message`, and `state` fields.

### turtledb-com is a transfer protocol

From a storage point-of-view, a `Turtle` is a sequence of *changes*.
Each *change* is described in a byte array.
A `Turtle` can be synced just by sending any missing byte arrays.

From the codec's point-of-view, a `Turtle` is a dictionary of values and sub-values.
The `Turtle`'s dictionary of reusable values grows with each new *change*.
As the dictionary grows, the efficiency of the protocol increases.

### turtledb-com is a service provider

turtledb-com as a service provides a file-system for virtual computers described in JavaScript, HTML, and CSS.

turtledb.com is the built-in service provider designed to handle realistic-levels of human-scale usage.

### turtledb-com includes a display framework

This project uses a light-weight display framework to simplify data rendering. 
It's not a core part of the problem-solution but it's part of turtledb-com (you don't have to use it but you'll see it in this project).

## Additional Documentation

> [!WARNING] 
> This section is fictional, notes-to-self, and/or rough-sketches for now

* [Basic Usage](docs/basic_usage.md)
* [Server Setup](docs/server_setup.md)
* [Turtles, and Peers, and S3](docs/turtles_peers_s3.md)
