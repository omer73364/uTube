import "./src/polyfills";
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import "./src/tasks";
import { AppRegistry } from "react-native";
import App from "./App";
import { name } from "./app.json";
AppRegistry.registerComponent(name, () => App);
