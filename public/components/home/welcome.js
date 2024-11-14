import { h } from '../../js/display/h.js'
import { render } from '../../js/display/render.js'
import { deriveDefaults } from '../../js/utils/components.js'

const { recaller, elementName } = deriveDefaults(import.meta.url)
console.log(elementName)
window.customElements.define(elementName, class extends window.HTMLElement {
  constructor () {
    super()
    this.attachShadow({ mode: 'open' })
  }

  connectedCallback () {
    render(this.shadowRoot, () => h`
      <style>
        :host {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          flex-grow: 1;
          background: HoneyDew;
          color: SeaGreen;
          padding: 0 min(100vw, calc(50vw - 45rem));
        }
        article {
          display: flex;
          flex-wrap: wrap;
          justify-content: end;
          border-width: 1px 0;
          border-style: solid;
          border-color: MediumSpringGreen;
          border-radius: 1rem;
          padding: 0.25rem 1rem;
          align-content: flex-start;
        }
        article:last-child {
          flex-grow: 1;
        }
        h1,
        h2 {
          flex-shrink: 0;
          flex-basis: 15rem;
          flex-grow: 1;
        }
        p {
          flex-basis: 25rem;
          flex-grow: 1;
          align-content: flex-end;
          margin: 2rem 2rem 0.5rem;
        }
        svg {
          position: absolute;
          right: max(5rem, calc(50vw - 40rem));
        }
      </style>

      <article>
        <h1>
          Make something.
        </h1>
        <p>
          turtledb.com makes it easy.
          <ol>
            <li>
              Choose a username.
            </li>
            <li>
              Enter it in the "username" field.
            </li>
            <li>
              Right click on "password" and have your browser generate one (or come up with one yourself... we're not your mom)
            </li>
            <li>
              Leaving "turtlename" blank will default it to "home" which is fine but you can choose one if you want.
            </li>
            <li>
              Click the "Load/Create Turtle" button.
            </li>
            <li>
              If no one's used your username/password combination the template chooser will replace this section.
            </li>
            <li>
              Choose "Basic Template".
            </li>
          </ol>
          Try it, you'll like it!
        </p>
        <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
          <path stroke="SeaGreen" fill="MediumSpringGreen" stroke-width="3" d="M 10 90 A 70 70 0 0 0 80 20 L 90 20 L 70 5 L 50 20 L 60 20 A 50 50 0 0 1 10 70 Z"/>
        </svg>
      </article>

      <article>
        <h2>
          Yes, you!
        </h2>
        <p>
          The World Wide Web is made with you in mind.
          This project uses the bog-standard web built into your browser.
          CSS, HTML, and JavaScript are meant to be used by everyone.
          For the last 3 decades the inventor of the internet and other really smart people (the W3C) have made continuous, thoughtful improvements.
          The web has never been more powerful or easier to use than it is today!
          Type some words and share them online (it doesn't have to be rocket surgery to be useful).
          You can do it! 
          We believe in you!
        </p>
      </article>

      <article>
        <h2>
          It's going to be great!
        </h2>
        <p>
          The tutorial starts with small changes and simple steps.
          CSS, HTML, and JavaScript are the most popular programming languages.
          Nothing comes with more support and resources dedicated to your success.
          We can't wait to see what you'll make!
        </p>
      </article>


      <article>
        <h2>
          ...but we're under construction right now so please be patient with us.
        </h2>
        <p>
          This project is currently a work in progress.
          Here's what we're currently focused on.
          <ul>
            <li><s>starting templates</s> (enough to <i>technically</i> demo)</li>
            <li>better starting templates (in progress)</li>
            <li>clean up memory leaks</li>
            <li>switch to proxies to enable partial rerenders</li>
            <li>spend a few days trying to make it pretty</li>
          </ul>
        </p>
      </article>
    `, recaller, elementName)
  }
})
