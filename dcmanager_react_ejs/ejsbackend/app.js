var createError = require('http-errors');
var express = require('express');
var cors = require('cors');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

const { Sequelize, DataTypes, DatabaseError } = require('sequelize');
const { promises } = require('dns');

const sequelize = new Sequelize('postgres://server:proiect@192.168.15.2:5432/datacenter_usage?timezone=local');

const Log = sequelize.define('log', {
  log_id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  server_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  },
  cpu_percent: {
    type: DataTypes.NUMERIC(4, 2),
    allowNull: false
  },
  memory_usage_gb: {
    type: DataTypes.NUMERIC(5, 2),
    allowNull: false
  }
}, {
  tableName: 'logs',
  timestamps: false
});

const DiskLog = sequelize.define('DiskLog', {
  disk_log_id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  disk_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  disk_usage_gb: {
    type: DataTypes.NUMERIC(6, 2),
    allowNull: false
  },
  log_id: {
    type: DataTypes.BIGINT,
    allowNull: false
  }
}, {
  tableName: 'disk_logs',
  timestamps: false
});

const Disk = sequelize.define('Disks', {
  disk_id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  server_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  disk_total_gb: {
    type: DataTypes.NUMERIC(6, 2),
    allowNull: false
  },
  disk_used_gb: {
    type: DataTypes.NUMERIC(6, 2),
    allowNull: false
  },
  partition: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'disks',
  timestamps: false // Assuming the table doesn't have createdAt and updatedAt fields
});

const Server = sequelize.define('Server', {
    server_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    memory_total_gb: {
      type: DataTypes.NUMERIC(5, 2),
      allowNull: false
    },
    server_ip: {
      type: DataTypes.STRING,
      allowNull: false
    },
    server_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    }
}, {
  tableName: 'servers',
  timestamps: false
});

Log.belongsTo(Server, { foreignKey: 'server_id' }); // Define association with servers table
DiskLog.belongsTo(Log, { foreignKey: 'log_id' }); // Define association with logs table
DiskLog.belongsTo(Disk, { foreignKey: 'disk_id' }); // Define association with disks table
Disk.belongsTo(Server, { foreignKey: 'server_id' }); // Define association with servers table
Server.hasMany(Log, { foreignKey: 'server_id' }); // Define association with logs table
Server.hasMany(Disk, { foreignKey: 'server_id' }); // Define association with disks table

try {
  sequelize.authenticate().then(data => {
    console.log('Connection has been established successfully.');
  })
} catch (error) {
  console.error('Unable to connect to the database:', error);
}

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());

app.use('/', indexRouter);
app.use('/users', usersRouter);

function internalError(error) {
  res.status(503).send('Internal API error. ' + error);
}

function removeFieldFromObjects(objects, fieldToRemove) {
  return objects.map(obj => {
    const { [fieldToRemove]: _, ...rest } = obj; // Destructure the object and remove the specified field
    return rest; // Return the modified object without the specified field
  });
}

app.get('/fetchServerDataByID/:server_id/:interval', (req, res) => {
  //req.params.server_id
  
  try
  {
    if(! /^[1-9]\d{0,9}$/ .test(req.params.server_id)) {
      res.send('Parametrul dat nu reprezinta un ID.');
      return;
    }

    let server;
    Server.findOne({where: {server_id: req.params.server_id}}).then(srv => {
      if(srv === null) {
        res.send(`Serverul cu ID ${req.params.server_id} nu a fost gasit !`);
        return;
      }
      server = srv.dataValues
      prom = [];

      prom.push(
        Log.findAll({where: {server_id: server.server_id,
                            timestamp: sequelize.literal(`"timestamp" >= CURRENT_TIMESTAMP - INTERVAL '${req.params.interval} minute'`)
        }})
            .then(logs => {
              server.logs = removeFieldFromObjects(logs.map(log => log.dataValues), "server_id");                
            })
        );
      prom.push(
        Disk.findAll({where: {server_id: server.server_id}})
            .then(disks => {
              server.disks = removeFieldFromObjects(disks.map(disk => disk.dataValues), "server_id");
            })
        );
        
      
      Promise.all(prom).then( () => {
        let dlprom = []
        for(let log of server.logs)
            dlprom.push(
              DiskLog.findAll({where: {log_id: log.log_id}})
                      .then(diskLogs => {
                        log.diskLogs = removeFieldFromObjects(diskLogs.map(diskLog => diskLog.dataValues), "log_id");
                      })
            );
        Promise.all(dlprom).then(() => {
          res.send(server);
        });
      });

    });
  }
  catch(error) {
    internalError(error);
  }
});

app.get('/fetchServerDataByID/:server_id', (req, res) => {
  //req.params.server_id
  try
  {
    if(! /^[1-9]\d{0,9}$/ .test(req.params.server_id)) {
      res.send('Parametrul dat nu reprezinta un ID.');
      return;
    }

    let server;
    Server.findOne({where: {server_id: req.params.server_id}}).then(srv => {
      if(srv === null) {
        res.send(`Serverul cu ID ${req.params.server_id} nu a fost gasit !`);
        return;
      }
      server = srv.dataValues
      prom = [];

      prom.push(
        Log.findAll({where: {server_id: server.server_id}})
            .then(logs => {
              server.logs = removeFieldFromObjects(logs.map(log => log.dataValues), "server_id");                
            })
        );
      prom.push(
        Disk.findAll({where: {server_id: server.server_id}})
            .then(disks => {
              server.disks = removeFieldFromObjects(disks.map(disk => disk.dataValues), "server_id");
            })
        );
        
      
      Promise.all(prom).then( () => {
        let dlprom = []
        for(let log of server.logs)
            dlprom.push(
              DiskLog.findAll({where: {log_id: log.log_id}})
                      .then(diskLogs => {
                        log.diskLogs = removeFieldFromObjects(diskLogs.map(diskLog => diskLog.dataValues), "log_id");
                      })
            );
        Promise.all(dlprom).then(() => {
          res.send(server);
        });
      });

    });
  }
  catch(error) {
    internalError(error);
  }
});

app.get('/fetchServerDataByIP/:server_ip', (req, res) => {
  //req.params.server_ip
  try
  {
    let server;
    Server.findOne({where: {server_ip: req.params.server_ip}}).then(srv => {
      if(srv === null) {
        res.send(`Serverul cu ip ${req.params.server_ip} nu a fost gasit !`);
        return;
      }
      server = srv.dataValues
      prom = [];

      prom.push(
        Log.findAll({where: {server_id: server.server_id}})
            .then(logs => {
              server.logs = removeFieldFromObjects(logs.map(log => log.dataValues), "server_id");                
            })
        );
      prom.push(
        Disk.findAll({where: {server_id: server.server_id}})
            .then(disks => {
              server.disks = removeFieldFromObjects(disks.map(disk => disk.dataValues), "server_id");
            })
        );
        
      
      Promise.all(prom).then( () => {
        let dlprom = []
        for(let log of server.logs)
            dlprom.push(
              DiskLog.findAll({where: {log_id: log.log_id}})
                      .then(diskLogs => {
                        log.diskLogs = removeFieldFromObjects(diskLogs.map(diskLog => diskLog.dataValues), "log_id");
                      })
            );
        Promise.all(dlprom).then(() => {
          res.send(server);
        });
      });

    });
  }
  catch(error) {
    internalError(error);
  }
});

app.get('/fetchAllServersData', (req, res) => {
  try
  {
    let servers;
    Server.findAll().then(srvrs => {
      servers = srvrs.map(srv => srv.dataValues);
      prom = [];
      for(let server of servers) {
        prom.push(
          Log.findAll({where: {server_id: server.server_id}})
             .then(logs => {
                server.logs = removeFieldFromObjects(logs.map(log => log.dataValues), "server_id");                
              })
          );
        prom.push(
          Disk.findAll({where: {server_id: server.server_id}})
              .then(disks => {
                server.disks = removeFieldFromObjects(disks.map(disk => disk.dataValues), "server_id");
              })
          );
        
      }
      Promise.all(prom).then( () => {
        let dlprom = []
        for(let server of servers) 
          for(let log of server.logs)
              dlprom.push(
                DiskLog.findAll({where: {log_id: log.log_id}})
                       .then(diskLogs => {
                          log.diskLogs = removeFieldFromObjects(diskLogs.map(diskLog => diskLog.dataValues), "log_id");
                       })
              );
        Promise.all(dlprom).then(() => {
          res.send(servers);
        });
      });

    });
  }
  catch(error) {
    internalError(error);
  }
});


app.get('/getServerList', (req, res) => {
  Server.findAll().then(servers => {
    console.log(typeof(servers));
    res.send(servers);
  }).catch(error => {
    console.log(error);
    res.status(503).send("Eroare baza de date !");
  })
});

app.get('/', (req, res) => {
  res.send('Hello, Express!');
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});


// Start the server
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
