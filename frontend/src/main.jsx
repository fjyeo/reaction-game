import { StrictMode } from 'react'  // enables extra dev checks in development mode
import { createRoot } from 'react-dom/client' // renders React components to the DOM by creating a root element and rendering the app into it
import './index.css' // global CSS file for styling the app
import App from './App.jsx' // imports the top-level app component

createRoot(document.getElementById('root')).render( // queries the DOM for the container element with id root and creates a react root attached to it. Wraps the app in a StrictMode to enable the extra dev checks
  <StrictMode>
    <App /> 
  </StrictMode>, 
)
