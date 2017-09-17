module.exports = function(wallaby) {
    return {
        files: [
            '@dependency-updater/**/source/**/*.js',
            '!@dependency-updater/**/source/**/*.spec.js',
        ],

        tests: ['@dependency-updater/**/source/**/*.spec.js'],

        env: {
            type: 'node',
        },

        compilers: {
            '**/*.js': wallaby.compilers.babel(),
        },

        testFramework: 'ava',

        debug: true,
    };
};
