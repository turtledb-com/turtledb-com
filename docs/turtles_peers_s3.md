# TURTLES

## what is a turtle?

a turtle is a progressive snapshot of all a user's data

* a turtle is a committed value following an encoded dictionary of any previously used values, sub-values, and previous commits
* a turtle has its own memory holding new values followed by the commit itself.
* a turtle may have a pointer to a previous turtle 


## who needs a turtle?

everybody

## how do we share our turtle?
one of three ways:
1. sharing a direct link to it's url
2. through another turtle with the branch name of our turtle
3. using a bale (group of turtles)

### sharing a direct link
every committed turtle has a unique url: 
"`${hostname}/${baleName}/${branchName}?${commitAddress}`"
> e.g.: "`turtledb.com/5h84x46xx.../5hj84x46xx...?1234`"
> * `baleName` is optional.  if there's no `baleName`, assume it's the same as `branchName`. 
>   * e.g.: "`turtledb.com/5h84x46xx...?1234`"
> * `commitAddress` is optional (unless you need a specific turtle).  if it's missing, use the branch's last address
>   * e.g.: 
"`turtledb.com/5h84x46xx...`"

### through another turtle
turtles can load each other
```
const peer = new Peer('foo bar')
peer.connect(connectionToTheTurtleverse)
const branch = peer.getBranch('5h84x46xx...', '5h846x46xx...', 'turtledb.com')
await branch.loaded
const sharedTurtle = branch.lookup(commitAddress)
```

### using a bale
we can create our turtle inside a bale. the list of turtles in a bale can be queried. the only requirement to create a turtle inside a bale or to list a bale is to know the name of the bale.
```
const sharedBaleName = '84hrnjf8ue...'
const myBranchName = '5h84x46xx...'

const peer = new Peer('whatever')
const myBranch = peer.getBranch(sharedBaleName, myBranchName)
// append commit(s) to myBranch
```

```
// later... (on someone else's computer)
const branches = peer.getBranches(sharedBaleName, 'turtledb.com')
await branches.ready
// do something with branches (including mine)
```