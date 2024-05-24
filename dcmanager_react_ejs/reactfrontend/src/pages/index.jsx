import React, { useState, useEffect } from 'react';
import Header from "../components/header";
import axios from 'axios';
import Dropdown from 'react-bootstrap/Dropdown';
import SelectedServerDiv from '../components/selectedServerDiv'; // Import the component to render based on selected server

const IndexPage = () => {
    const [servers, setServers] = useState([]);
    const [selectedServer, setSelectedServer] = useState(null); // State to track the selected server

    useEffect(() => {
        axios.get('http://localhost:3001/getServerList')
            .then(response => {
                setServers(response.data);
            })
            .catch(error => {
                console.log('A survenit eroare: ', error);
            });
    }, []);

    const handleServerSelect = (server) => {
        setSelectedServer(server); // Update selected server state when a server is selected
    };

    const serverButtons = servers.map(server => (
        <Dropdown.Item key={server.server_id} onClick={() => handleServerSelect(server)}>
            {server.server_name}
        </Dropdown.Item>
    ));

    return (
        <>
            <Header/>

            <Dropdown>
                <Dropdown.Toggle variant="success" id="dropdown-basic">
                    Alege serverul
                </Dropdown.Toggle>

                <Dropdown.Menu>
                    {serverButtons}
                </Dropdown.Menu>
            </Dropdown>

            {selectedServer && <SelectedServerDiv server={selectedServer} />} {/* Render SelectedServerDiv if a server is selected */}
        </>
    );
};

export default IndexPage;
