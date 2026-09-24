#!/bin/sh
set -eu

aws s3api wait bucket-exists --bucket datasets
aws s3 cp /init/data/ s3://datasets/ --recursive \
  --cache-control no-cache --only-show-errors

printf 'Dataset files uploaded to the datasets bucket.\n'
