provider "aws" {
  region     = "${var.region}"
}

resource "aws_iam_role" "iam_for_dependency_updater" {
    name = "iam_for_dependency_updater"
    assume_role_policy = "${file("${path.module}/assumeRole.json")}"
}

resource "aws_iam_role_policy" "test_policy" {
    name = "test_policy"
    role = "${aws_iam_role.iam_for_dependency_updater.id}"
    policy = "${file("${path.module}/rolePolicy.json")}"
}

resource "aws_lambda_function" "dependency_updater" {
    filename = "distribution/lambda.zip"
    function_name = "dependency-updater"
    role = "${aws_iam_role.iam_for_dependency_updater.arn}"
    handler = "distribution/index.handler"
    runtime = "nodejs4.3"
    source_code_hash = "${base64sha256(file("distribution/lambda.zip"))}"
}

resource "aws_cloudwatch_event_rule" "every_five_minutes" {
    name = "every-five-minutes"
    description = "Fires every five minutes"
    schedule_expression = "rate(5 minutes)"
}

resource "aws_cloudwatch_event_target" "execute_dependency_updater_every_5_minutes" {
    rule = "${aws_cloudwatch_event_rule.every_five_minutes.name}"
    arn = "${aws_lambda_function.dependency_updater.arn}"
}

resource "aws_lambda_permission" "connect_cloudwatch_with_dependency_updater" {
    statement_id = "dependencyUpdaterEvery5Minutes"
    action = "lambda:InvokeFunction"
    function_name = "${aws_lambda_function.dependency_updater.function_name}"
    principal = "events.amazonaws.com"
    source_arn = "${aws_cloudwatch_event_rule.every_five_minutes.arn}"
}
