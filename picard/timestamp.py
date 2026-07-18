# -*- coding: utf-8 -*-
PLUGIN_NAME = 'timestamp'
PLUGIN_AUTHOR = 'majkinetor'
PLUGIN_DESCRIPTION = 'Timestamp function for tagger-script'
PLUGIN_VERSION = "0.1"
PLUGIN_API_VERSIONS = ["2.0"]

from picard.script import register_script_function

def timestamp(parser):
	import datetime
	now = datetime.datetime.now()
	return now.strftime("%Y-%m-%d %H:%M")

register_script_function(timestamp)