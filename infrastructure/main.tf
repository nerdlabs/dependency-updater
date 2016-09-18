provider "aws" {
  region     = "${var.region}"
}

resource "aws_iam_role" "iam_for_dependency_updater" {
    name = "iam_for_dependency_updater"
    assume_role_policy = "${file("${path.module}/assumeRole.json")}"
}

resource "aws_lambda_function" "dependency_updater" {
    filename = "distribution/lambda.zip"
    function_name = "dependency-updater"
    role = "${aws_iam_role.iam_for_dependency_updater.arn}"
    handler = "distribution/index.handler"
    runtime = "nodejs4.3"
    source_code_hash = "${base64sha256(file("distribution/lambda.zip"))}"
}
