'use strict';

const path = require('path');
const ZwaveDriver = require('homey-zwavedriver');

// http://www.vesternet.com/downloads/dl/file/id/196/product/1128/z_wave_danfoss_lc_13_living_connect_radiator_thermostat_manual.pdf

module.exports = new ZwaveDriver(path.basename(__dirname), {
	debug: true,
	capabilities: {
		measure_battery: {
			getOnWakeUp: true,
			command_class: 'COMMAND_CLASS_BATTERY',
			command_get: 'BATTERY_GET',
			command_report: 'BATTERY_REPORT',
			command_report_parser: (report, node) => {

				// If prev value is not empty and new value is empty
				if (node && node.state && node.state.measure_battery !== 1 && report['Battery Level'] === "battery low warning") {

					// Trigger device flow
					Homey.manager('flow').triggerDevice('battery_alarm', {}, {}, node.device_data, err => {
						if (err) console.error('Error triggerDevice -> battery_alarm', err);
					});
				}
				if (report['Battery Level'] === 'battery low warning') return 1;
				if (report.hasOwnProperty('Battery Level (Raw)')) return report['Battery Level (Raw)'][0];
				return null;
			}
		},
		target_temperature: {
			command_class: 'COMMAND_CLASS_THERMOSTAT_SETPOINT',
			command_get: 'THERMOSTAT_SETPOINT_GET',
			command_get_parser: function () {
				return {
					'Level': {
						'Setpoint Type': 'Heating 1',
					}
				};
			},
			command_set: 'THERMOSTAT_SETPOINT_SET',
			command_set_parser: function (value, node) {

				module.exports.realtime(node.device_data, 'target_temperature', Math.round(value * 2) / 2);

				// Create value buffer
				let a = new Buffer(2);
				a.writeUInt16BE(( Math.round(value * 2) / 2 * 10).toFixed(0));

				return {
					'Level': {
						'Setpoint Type': 'Heating 1'
					},
					'Level2': {
						'Size': 2,
						'Scale': 0,
						'Precision': 1
					},
					'Value': a
				};
			},
			command_report: 'THERMOSTAT_SETPOINT_REPORT',
			command_report_parser: report => {
				if (report.hasOwnProperty('Level2')
					&& report.Level2.hasOwnProperty('Scale')
					&& report.Level2.hasOwnProperty('Precision')
					&& report.Level2['Scale'] === 0
					&& typeof report.Level2['Size'] !== 'undefined') {

					let readValue;
					try {
						readValue = report['Value'].readUIntBE(0, report.Level2['Size']);
					} catch (err) {
						return null;
					}

					if (typeof readValue !== 'undefined') {
						return readValue / Math.pow(10, report.Level2['Precision']);
					}
					return null;
				}
				return null;
			},
		},
	},
	settings: {}
});
