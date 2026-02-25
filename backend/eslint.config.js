module.exports = [
    {
        files: ["src/**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "commonjs",
            globals: {
                process: "readonly",
                console: "readonly",
                module: "readonly",
                require: "readonly",
                __dirname: "readonly",
                Buffer: "readonly",
                setTimeout: "readonly"
            }
        },
        rules: {
            "semi": ["error", "always"],
            "quotes": ["error", "single"],
            "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
        }
    }
];
