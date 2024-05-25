#!/usr/bin/env node
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import inquirer from "inquirer";

async function createMainDirectory() {
  const folders = ["backend"];
  const targetDir = process.cwd();
  const folderNames = await promptMainDirectory(inquirer.prompt, folders);

  try {
    folderNames.forEach((folderName) => {
      const destination = path.join(targetDir, folderName);
      fs.mkdirSync(destination);
      console.log(`Created folder: ${destination}`);
    });

    console.log("Main directory structure created successfully!");

    if (folderNames.length > 0) {
      const backendFolderName = folderNames[0];
      await createBackendStructure(backendFolderName);
      const selectedPackages = await promptAndInstallPackages(
        backendFolderName
      );
      const mainFileName = await promptMainFileName(inquirer.prompt);
      await createMainFile(backendFolderName, mainFileName, selectedPackages);
      await updatePackageJson(backendFolderName, mainFileName);

      if (selectedPackages.includes("mongoose")) {
        await createConnectDBFile(backendFolderName);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

async function createBackendStructure(folderName) {
  const folders = [
    "db",
    "models",
    "routes",
    "controllers",
    "middlewares",
    "utils",
    "validators",
  ];
  const targetDir = path.join(process.cwd(), folderName);

  const folderNames = await promptFolderNames(inquirer.prompt, folders);

  try {
    folderNames.forEach((folderName) => {
      const destination = path.join(targetDir, folderName);
      fs.mkdirSync(destination);
      console.log(`Created folder: ${destination}`);
    });

    console.log("Backend structure created successfully!");
  } catch (err) {
    console.error("Error creating backend structure:", err);
  }
}

async function promptAndInstallPackages(folderName) {
  const targetDir = path.join(process.cwd(), folderName);
  const packages = [
    "mongoose",
    "cors",
    "dotenv",
    "body-parser",
    "morgan",
    "jsonwebtoken",
    "zod",
    "bcryptjs",
    "cookie-parser",
    "uuid",
    "multer",
  ];

  const devPackages = ["nodemon"];
  const alwaysInstalledPackages = ["express"];

  const questions = packages.map((pkg) => ({
    type: "confirm",
    name: pkg,
    message: `Do you want to install ${pkg}?`,
    default: true,
  }));

  try {
    const answers = await inquirer.prompt(questions);

    const selectedPackages = packages.filter((pkg) => answers[pkg]);
    selectedPackages.push(...alwaysInstalledPackages);

    console.log("Initializing npm and installing packages...");
    return new Promise((resolve, reject) => {
      exec(`npm init -y`, { cwd: targetDir }, (err, stdout, stderr) => {
        if (err) {
          console.error(`Error initializing npm: ${err}`);
          reject(err);
          return;
        }
        exec(
          `npm install ${selectedPackages.join(" ")}`,
          { cwd: targetDir },
          (err, stdout, stderr) => {
            if (err) {
              console.error(`Error installing packages: ${err}`);
              reject(err);
              return;
            }
            console.log("Packages installed successfully!");
            exec(
              `npm install -D ${devPackages.join(" ")}`,
              { cwd: targetDir },
              (err, stdout, stderr) => {
                if (err) {
                  console.error(`Error installing dev packages: ${err}`);
                  reject(err);
                  return;
                }
                console.log("Dev packages installed successfully!");
                resolve(selectedPackages);
              }
            );
          }
        );
      });
    });
  } catch (err) {
    console.error("Error installing npm packages:", err);
    return Promise.reject(err);
  }
}

async function initializeNpm(targetDir) {
  return new Promise((resolve, reject) => {
    exec(`npm init -y`, { cwd: targetDir }, (err, stdout, stderr) => {
      if (err) {
        console.error(`Error initializing npm: ${err}`);
        reject(err);
        return;
      }
      resolve();
    });
  });
}

async function promptMainDirectory(prompt, folders) {
  let names = [];
  const questions = folders.map((folder) => ({
    type: "input",
    name: folder,
    message: `Enter a name for the ${folder} directory (default: ${folder})`,
    default: folder,
  }));
  const answers = await prompt(questions);
  folders.forEach((folder) => {
    names.push(answers[folder]);
  });
  return names;
}

async function promptMainFileName(prompt) {
  const question = {
    type: "input",
    name: "mainFileName",
    message: "Enter a name for the main file (default: app.js):",
    default: "app.js",
  };
  const answer = await prompt(question);
  return answer.mainFileName;
}

async function createMainFile(
  mainDirectoryName,
  mainFileName = "app.js",
  packages = []
) {
  const targetDir = path.join(process.cwd(), mainDirectoryName);
  const mainFilePath = path.join(targetDir, mainFileName);

  const importStatements = packages
    .map((pkg) => {
      if (pkg === "body-parser") {
        return "import bodyParser from 'body-parser';";
      }
      if (pkg === "cookie-parser") {
        return "import cookieParser from 'cookie-parser';";
      }
      if (pkg === "method-override") {
        return "import methodOverride from 'method-override';";
      }
      if (pkg === "express-validator") {
        return "import { body, validationResult } from 'express-validator';";
      }
      return `import ${pkg} from '${pkg}';`;
    })
    .join("\n");

  const dotenvConfig = packages.includes("dotenv")
    ? `import dotenv from 'dotenv';\n\ndotenv.config({ path: './.env' });\n\nconst PORT = process.env.PORT || 3000;\n`
    : `const PORT = process.env.PORT || 3000;\n`;

  const additionalConfigs = [];

  if (packages.includes("body-parser")) {
    additionalConfigs.push("app.use(bodyParser.json());");
    additionalConfigs.push(
      "app.use(bodyParser.urlencoded({ extended: true }));"
    );
  }

  if (packages.includes("cookie-parser")) {
    additionalConfigs.push("app.use(cookieParser());");
  }
  if (packages.includes("morgan")) {
    additionalConfigs.push("app.use(morgan('dev'));");
  }
  if (packages.includes("cors")) {
    additionalConfigs.push("app.use(cors());");
  }
  if (packages.includes("method-override")) {
    additionalConfigs.push("app.use(methodOverride('_method'));");
  }

  const fileContent = `// Your main file content goes here
${importStatements}

${
  packages.includes("mongoose") ? "import connectDB from './db/connectDB';" : ""
}

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

${additionalConfigs.join("\n")}

${dotenvConfig}
app.listen(PORT, () => {
    console.log(\`App is listening on \${PORT}\`);
    ${packages.includes("mongoose") ? "connectDB();" : ""}
});
`;

  try {
    fs.writeFileSync(mainFilePath, fileContent);
    console.log(`Created file: ${mainFilePath}`);
  } catch (err) {
    console.error("Error creating main file:", err);
  }
}

async function createConnectDBFile(backendFolderName) {
  const targetDir = path.join(process.cwd(), backendFolderName, "db");
  const connectDBFilePath = path.join(targetDir, "connectDB.js");

  const fileContent = `import mongoose from 'mongoose';

const connectDB = () => {
    mongoose
        .connect(process.env.MONGO_URL || "mongodb://127.0.0.1:27017/projectName'")
        .then(() => {
            console.log('Connected to the database');
        })
        .catch((err) => {
            console.error('Error connecting to the database:', err.message);
        });
};

export default connectDB;
`;

  try {
    fs.writeFileSync(connectDBFilePath, fileContent);
    console.log(`Created file: ${connectDBFilePath}`);
  } catch (err) {
    console.error("Error creating connectDB file:", err);
  }
}

async function updatePackageJson(mainDirectoryName, mainFileName) {
  const targetDir = path.join(process.cwd(), mainDirectoryName);
  const packageJsonPath = path.join(targetDir, "package.json");

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    packageJson.main = mainFileName;
    packageJson.type = "module";
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(`Updated package.json main field to: ${mainFileName}`);
    console.log(`Set package.json type to module`);
  } catch (err) {
    console.error("Error updating package.json:", err);
  }
}

async function promptFolderNames(prompt, folders) {
  const questions = folders.map((folder) => ({
    type: "input",
    name: folder,
    message: `Enter a folder name for ${folder} (default: ${folder}):`,
    default: folder,
  }));

  const answers = await prompt(questions);
  return Object.values(answers);
}

createMainDirectory();
