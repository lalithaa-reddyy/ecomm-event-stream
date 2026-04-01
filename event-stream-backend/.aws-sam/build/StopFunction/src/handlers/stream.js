exports.start = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "START event generated" })
  };
};

exports.stop = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "STOP event generated" })
  };
};

exports.anomaly = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "ANOMALY event generated" })
  };
};