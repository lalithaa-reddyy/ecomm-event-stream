exports.start = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "START event generated" })
  };
  console.log("START endpoint called");
};

exports.stop = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "STOP event generated" })
  };
  console.log("STOP endpoint called");
};

exports.anomaly = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "ANOMALY event generated" })
  };
  console.log("ANOMALY endpoint called");

};