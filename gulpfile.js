const gulp = require('gulp');
const jsdoc = require('gulp-jsdoc3');

gulp.task('doc', cb=>{
  const config = {
    opts: {
      destination: './docs'
    }
  };
  gulp.src(['./bolt/**/*.js'], {read: false})
    .pipe(jsdoc(config, cb));
});