import psutil
import time
import sys
import shutil
import psycopg2
import socket
import fcntl
import struct
import os
import netifaces as ni
import signal
import sys

conn = None
cursor = None

def signal_handler(signal, frame):
    if cursor != None:
        cursor.close()
    if conn != None:
        conn.close()
    
    print('\nConnection closed')
    sys.exit(0)


DEFAULT_QUANT = 1 # seconds

def get_ip_address(ifname):
    ip = ni.ifaddresses(ifname)[ni.AF_INET][0]['addr']
    return ip

#def get_disk_usage():
#    disk_usage = psutil.disk_usage('/')
#    return disk_usage
def get_disk_usage():
    disk_usage = {}
    partitions = psutil.disk_partitions(all=True)
    for partition in partitions:
        # Skip EFI partitions (identified by filesystem type 'vfat')
        if partition.fstype == 'vfat':
            continue
        usage = psutil.disk_usage(partition.mountpoint)
        disk_usage[partition.device] = {
            "total": usage.total,
            "used": usage.used,
            "free": usage.free,
            "percent": usage.percent
        }
    return disk_usage

def get_disk_dict():
    disk_usage = get_disk_usage()
    disk_dict = []
    drive_data = None
    for drive, usage_info in disk_usage.items():
        if 'dev/' in drive and 'loop' not in drive:
            drive_total = round(usage_info['total']/1024/1024/1024,2)
            drive_used = round(usage_info['used']/1024/1024/1024,2)
            drive_free = round(usage_info['free']/1024/1024/1024,2)
            drive_percent = usage_info['percent']
            #print(f"Drive: {drive}")
            #print(f"Total: {drive_total} GB")
            #print(f"Used: {drive_used} GB")
            #print(f"Free: {drive_free} GB")
            #print(f"Usage: {drive_percent}%")
            #print()
            drive_data = {"name": drive, "total": drive_total, "used": drive_used, "free": drive_free, "percent": drive_percent}
            disk_dict.append(drive_data)
    return disk_dict


def main():
    self_ip = get_ip_address('enp0s3')
    server_id = None

    conn = psycopg2.connect(
        host='192.168.15.2',
        database='datacenter_usage',
        user='server',
        password='proiect'
    )

    cursor = conn.cursor()
    conn.autocommit = True

    signal.signal(signal.SIGINT, signal_handler)

    ram_data = {"total": round(psutil.virtual_memory().total/1024/1024/1024, 2) ,"percent": psutil.virtual_memory()[2], "usage": round(psutil.virtual_memory()[3]/1024/1024/1024,2)}

    # Verify if server exists in database by verifying its IP

    cursor.execute('SELECT server_id FROM Servers WHERE server_ip = \'' + self_ip + '\'')
    sv = cursor.fetchall()
    if len(sv) == 0: # server doesnt exist in database
        cursor.execute('INSERT INTO servers (server_name, memory_total_gb, server_ip) VALUES (\'{}\', {}, \'{}\')'.format(os.uname()[1], ram_data['total'], self_ip))

    # Check if disks are up to date in the database

    cursor.execute('SELECT server_id FROM Servers WHERE server_ip = \'' + self_ip + '\'')
    sv = cursor.fetchone()
    server_id = sv[0]
    disk_dict = get_disk_dict()

    cursor.execute('SELECT partition FROM disks WHERE server_id={}'.format(server_id))
    existent_partitions = (item[0] for item in cursor.fetchall())
    for partition in disk_dict:
        #print(partition['name'], existent_partitions)
        if partition['name'] in existent_partitions:
            cursor.execute('SELECT disk_total_gb FROM disks WHERE server_id={} and partition=\'{}\''.format(server_id, partition['name']))
            if partition['total'] != cursor.fetchone()[0]:
                cursor.execute('UPDATE disks SET disk_total_gb={} WHERE server_id={} and partition=\'{}\''.format(partition['total'],server_id, partition['name']))
            continue    
        cursor.execute('INSERT INTO disks (server_id, disk_total_gb, disk_used_gb, partition) VALUES ({}, {}, {}, \'{}\')'.format(server_id, partition['total'], partition['used'], partition['name']))


    while True:
        nr_sec = decide_time_interval()
        #disk_data = get_disk_usage()
        #print(disk_data)
        disk_dict = get_disk_dict()

        ram_data = {"total": round(psutil.virtual_memory().total/1024/1024/1024, 2) ,"percent": psutil.virtual_memory()[2], "usage": round(psutil.virtual_memory()[3]/1024/1024/1024,2)}
        cpu_usage = psutil.cpu_percent() 

        cursor.execute('INSERT INTO logs (server_id, cpu_percent, memory_usage_gb) VALUES ({}, {}, {}) RETURNING log_id'.format(server_id, cpu_usage, ram_data['usage']))
        log_id = cursor.fetchone()[0]

        for partition in disk_dict:
            cursor.execute('SELECT disk_id FROM disks WHERE server_id={} and partition=\'{}\''.format(server_id, partition['name']))
            disk_id = cursor.fetchone()[0]
            cursor.execute('INSERT INTO disk_logs (disk_id, log_id, disk_usage_gb) VALUES ({},{},{})'.format(disk_id, log_id, partition['used']))
            
            cursor.execute('SELECT disk_used_gb FROM disks WHERE server_id={} and partition=\'{}\''.format(server_id, partition['name']))
            if cursor.fetchone()[0] != partition['used']:
                cursor.execute('UPDATE disks SET disk_used_gb={} WHERE server_id={} and partition=\'{}\''.format(partition['used'],server_id, partition['name']))

        print('Sent data to database')
        #print('CPU Used: ', cpu_usage, '%')
        #print('RAM total: ', ram_data['total'])
        #print('RAM Used (GB):', ram_data['usage'])
        #print('RAM memory % used:', ram_data['percent'])
        #print()
        #print(disk_dict, ram_data)

        time.sleep(nr_sec)




def decide_time_interval():
    if len(sys.argv) > 1 and int(sys.argv[1]) >= 1: # don't allow updates under one second, to limit database usage at a few MB a day
        nr_sec = int(sys.argv[1])
    else:
        nr_sec = DEFAULT_QUANT
    return nr_sec

if __name__ == "__main__":
    main()
