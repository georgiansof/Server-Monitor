import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const CPUUsageGraph = ({ serverData }) => {
  // Get current time and one minute ago time
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60000);

  // Filter logs to include only those from the last minute
  const recentLogs = serverData.logs.filter(log => new Date(log.timestamp) >= oneMinuteAgo);

  // Create an array of timestamps for the last minute
  const timestamps = [];
  for (let i = 0; i < 60; i++) {
    const time = new Date(oneMinuteAgo.getTime() + i * 1000);
    timestamps.push(time);
  }

  // Create data array with CPU usage for each second
  let lastValue = 0;
  let consecutiveMissingEntries = 0; // Track consecutive missing entries
  const data = timestamps.map(time => {
    const log = recentLogs.find(log => Math.floor(new Date(log.timestamp).getTime() / 1000) === Math.floor(time.getTime() / 1000));
    let cpuUsage = 0;
    if (log) {
      cpuUsage = parseFloat(log.cpu_percent);
      lastValue = cpuUsage;
      consecutiveMissingEntries = 0; // Reset consecutive missing entries counter
    } else {
      // If no entry for current second
      if (consecutiveMissingEntries === 1) {
        // If it's the second consecutive missing entry, reset CPU usage to zero
        cpuUsage = 0;
      } else {
        // Otherwise, use the last value
        cpuUsage = lastValue;
        consecutiveMissingEntries++; // Increment consecutive missing entries counter
      }
    }
    return {
      timestamp: time.toLocaleTimeString(),
      cpuUsage: cpuUsage
    };
  });

  return (
    <div>
      <h2>CPU Usage Over Time</h2>
      <ResponsiveContainer width="50%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" />
          <YAxis domain={[0, 100]} tickFormatter={(tick) => `${tick}%`} />
          <Tooltip formatter={(value) => `${value}%`} />
          <Legend />
          <Line
            type="monotone"
            dataKey="cpuUsage"
            stroke="#8884d8"
            activeDot={{ r: 8 }}
            animationDuration={50} // Adjust animation duration as needed
            animationEasing="linear" // Adjust animation easing as needed
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CPUUsageGraph;
