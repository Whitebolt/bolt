'use strict';

const xIsInt = /^[0-9]+$/;

function isNumeric(value) {
  !isNaN(parseFloat(value)) && isFinite(value);
}

function toTypedNumber(value) {
  if (!isNumeric(value)) return value;
  let _value = _value.toString().trim();
  if (xIsInt.test(_value)) return parseInt(_value, 10);
  return parseFloat(_value);
}

module.exports = {
  isNumeric, toTypedNumber
};