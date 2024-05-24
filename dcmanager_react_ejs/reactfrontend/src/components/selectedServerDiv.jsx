import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CPUUsageGraph from './CPUUsageGraph';
import RAMUsageGraph from './RAMUsageGraph';
import DiskUsageGraph from './DiskUsageGraph';

const SelectedServerDiv = (props) => {
    const [serverData, setServerData] = useState(null);

    useEffect(() => {
        // Function to fetch server data
        const fetchData = () => {
            axios.get(`http://localhost:3001/fetchServerDataByID/${props.server.server_id}/1`)
                .then(response => {
                    setServerData(response.data); // Assuming server data is stored in response.data
                })
                .catch(error => {
                    console.log('An error occurred: ', error);
                    // Handle error if needed
                });
        };

        // Fetch data initially
        fetchData();

        // Set up interval to fetch data every second
        const intervalId = setInterval(fetchData, 1000);

        // Clean up interval on component unmount
        return () => clearInterval(intervalId);
    }, [props.server.server_id]); // Dependency array ensures useEffect runs when server_id changes

    if (serverData === null) {
        return <div>Loading...</div>; // Show loading message while data is being fetched
    }

    return (
        <div>
            <h1>Server Monitoring Dashboard</h1>
            <CPUUsageGraph serverData={serverData} />
            <RAMUsageGraph serverData={serverData} />
            <DiskUsageGraph serverData={serverData} />
        </div>
    );
};

export default SelectedServerDiv;
