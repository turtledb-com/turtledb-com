# turtledb-com

An achievable way to create **useful**[^1] applications.

> [!WARNING] 
> THIS PROJECT IS A WORK IN PROGRESS

[^1]: **Useful:** An application must be able to display, persist, and share user-generated data.

## The Problem

Setting up and maintaining the technologies to make an application **useful** is prohibitively expensive for a **human**[^2].

[^2]: **Human:** An person/app-user who is not-a-corporation.

## The Solution 
This project handles displaying, persisting, and sharing a **human-scale**[^3] amount of data.
By limiting the applications to **human-scale** usage we are able treat all the data a **human** ever creates as a single database entry.
This significantly reduces the complexities and costs associated with making an application.

[^3]: **Human-scale:** About 2MB of input data.
  -- The average human typing speed is 40 WPM. 
  2MB of typed data would take 175 hours to input. 

> [!NOTE] 
> The primary inspirations for this project are bittorrent, bitcoin, git, and the w3c. 

## Overview

Everything using this project is built on `Turtle`s.
A `Turtle` is an object that holds the entire collection of a **human**'s data encoded as arrays of bytes.
A `new Turtle` can be created using an existing `Turtle` and appending any changes to that `Turtle`.
Because a `Turtle` is an ongoing sequence of byte-arrays, every `Turtle` is a stream.
This makes them a cheap, easy, and standardized to deal with.

> [!NOTE] 
> Fun Fact: "Turtle" is a reference to ["Turtles All the Way Down"](https://en.wikipedia.org/wiki/Turtles_all_the_way_down)

### turtledb-com is version control

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

turtledb.com is the built-in service provider designed to handle realistic-levels of **human-scale** usage for free[^4].

[^4]: **Free**: until we abuse it and need to qualify what "persist" means...

### turtledb-com includes a display framework

I use a light-weight display framework to simplify data rendering. It's not a core part of the problem-solution but it's part of turtledb-com (you don't have to use it but you'll see it in this project).

## Additional Documentation

* [Basic Usage](docs/basic_usage.md)
* [Server Setup](docs/server_setup.md)
* [Turtles, and Peers, and S3](docs/turtles_peers_s3.md)
