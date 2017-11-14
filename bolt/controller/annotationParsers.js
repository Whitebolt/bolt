'use strict';

const {AdvancedSet} = require('map-watch');
const xSpaceOrComma = /,| /;

function _parseAnnotationSet(value, lowecase=false) {
  let _value = (lowecase?value.toLowerCase():value);
  return new AdvancedSet(
    _value.split(xSpaceOrComma).map(value=>value.trim()).filter(value=>(value.trim() !== ''))
  );
}

const _annotationParsers = [
  value=>{
    // @annotation key methods
    return _parseAnnotationSet(value, true);
  },
  ()=>{
    // @annotation key authenticated
    return true;
  },
  value=>{
    // @annotation key accepted-fields
    return _parseAnnotationSet(value);
  },
  value=>{
    // @annotation key accept-errors
    return bolt.toBool(value);
  },
  value=>{
    // @annotation key required-fields
    return _parseAnnotationSet(value);
  },
  value=>{
    // @annotation key accepts-content
    return _parseAnnotationSet(value);
  },
  value=>{
    // @annotation key accepts-connect
    return _parseAnnotationSet(value);
  }
];

_annotationParsers.forEach(parser=>bolt.annotation.addParser(parser));