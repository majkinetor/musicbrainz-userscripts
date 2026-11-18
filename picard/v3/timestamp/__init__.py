# -*- coding: utf-8 -*-


def timestamp(parser):
	import datetime
	now = datetime.datetime.now()
	return now.strftime("%Y-%m-%d %H:%M")

def enable(api):
    api.register_script_function(timestamp)