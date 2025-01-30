# Basic Usage Example
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
      await globalPeer.ready(myRepo)
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
