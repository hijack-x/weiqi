#!/bin/bash

CUR_DIR=$(cd "$(dirname "$0")"; pwd -P)

nohup node server.js &
