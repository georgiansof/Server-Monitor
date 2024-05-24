// import axios from 'axios';
// import './App.css';
// import Body from './components/body'

import 'bootstrap/dist/css/bootstrap.min.css';
import {HashRouter as Router, Routes, Route} from 'react-router-dom';
import IndexPage from './pages/index'

function App() {

  /*const apiCall = () => {
    axios.get('http://localhost:3001').then(console.log('woo!'));
  }*/

  return (
    <Router>
      <Routes>
        <Route path="/" element={<IndexPage/>}>

        </Route>
      </Routes>
    </Router>
  );
}

export default App;
