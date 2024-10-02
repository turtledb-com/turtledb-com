# turtledb-com
Live data presented everywhere (with history)

## THIS PROJECT IS NOT PRODUCTION READY
please interpret this README.md as speculative fiction. There are several critical tasks remaining before the example will work.

## Overview
The name "turtledb-com" is a reference to this "Turtles All the Way Down" idiom. 

turtledb-com is a version control database, a protocol, and a service provider. 
It includes a light-weight built-in display framework.

### turtledb-com is a version control database

In this project, a *Turtle* is an encoded JavaScript value. 
*Turtle* encoding isn't compact but it allows us to describe *Turtle*s as combinations of previously encoded *Turtle*s. 
*Turtle*s are encoded by appending a new head (potentially) referencing the previous *Turtle*s.
A *Commit* special type of *Turtle* that is signed by the owner of a stream and includes an additional meta-*Turtle* describing the new *Turtle*-state.

### turtledb-com is a protocol

*Turtle*s can be streamed just by sending their bytes.
Because new *Turtle*s are always combinations of previous *Turtle*s we are only sending new/missing sub-*Turtle*s.
As more *Turtle*s are streamed our dictionary of sub-*Turtle*s grows.
As the dictionary grows, the efficiency of the protocol increases.

### turtledb-com is a service provider
turtledb-com as a service provides a file-system for virtual computers described in JavaScript, HTML, and CSS.

turtledb.com is the built-in service provider designed to handle realistic-levels of human-scale usage for free.

#### Realistic-levels of human-scale usage
Using a keyboard, maximum human-scale data output is around 18 baud (212 wpm). 
1MB / 18 baud == 16+ hours. 
Realistically though... unless we're in data-entry, our data output is a few kB/day of highly-repetetive text.

## Usage example

### Create and clone your *Turtle*
1. Go to turtledb.com and login
1. open a new folder in a terminal that has node installed
1. `npx --package=turtledb-com fspeer` (you'll be prompeted to login)
1. open your new folder with the IDE of your choice

### Modify your *Turtle*
1. edit <your new folder>/components/start.js
1. save
1. notice that your log-in page includes your change

## Deeper dive documentation
* Encoding/decoding
* The Recaller
* Uint8ArrayLayerPointer and Committer
* ``` h`` ``` and `render()`
* how the start page works

