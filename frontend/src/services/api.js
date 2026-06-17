import axios from "axios";

const API = axios.create({
  baseURL: "http://10.52.129.168:5000/api",
});

export default API;