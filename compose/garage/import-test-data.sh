#!/bin/sh
set -eu

aws s3api wait bucket-exists --bucket datasets
aws s3 sync /init/data/ s3://datasets/ --delete \
  --cache-control no-cache --only-show-errors

printf 'Dataset files synced to the datasets bucket.\n'
