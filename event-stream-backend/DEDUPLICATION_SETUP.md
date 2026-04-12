# CloudFormation Template for Deduplication Table

This document shows how to add the deduplication table to your SAM/CloudFormation template.

## Update to template.yaml

Add the following resources to your `template.yaml`:

```yaml
  DedupTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub '${AWS::StackName}-event-dedup'
      AttributeDefinitions:
        - AttributeName: eventId
          AttributeType: S
      KeySchema:
        - AttributeName: eventId
          KeyType: HASH
      BillingMode: PAY_PER_REQUEST
      TimeToLiveSpecification:
        AttributeName: ttl
        Enabled: true
      Tags:
        - Key: Purpose
          Value: EventDeduplication
        - Key: Environment
          Value: !Ref EnvironmentParameter
```

## Update Lambda Function Environment Variables

In your Lambda function definition, add the environment variable:

```yaml
  StreamFunction:
    Type: AWS::Serverless::Function
    Properties:
      # ... existing properties ...
      Environment:
        Variables:
          # ... existing env vars ...
          DEDUP_TABLE: !Ref DedupTable
          AGG_TABLE: !Ref AggregationTable
          RAW_BUCKET: !Ref RawEventsBucket
          ANOMALY_BUCKET: !Ref AnomalyEventsBucket
          SNS_TOPIC_ARN: !Ref AnomalyNotificationTopic
```

## Update IAM Permissions

Update your Lambda execution role to include permissions for the dedup table:

```yaml
  StreamFunctionRole:
    Type: AWS::IAM::Role
    Properties:
      # ... existing properties ...
      Policies:
        - PolicyName: DynamoDBDedupAccess
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - dynamodb:UpdateItem
                Resource: !GetAtt DedupTable.Arn
              - Effect: Allow
                Action:
                  - dynamodb:UpdateItem
                  - dynamodb:Scan
                Resource: !GetAtt AggregationTable.Arn
              - Effect: Allow
                Action:
                  - s3:PutObject
                Resource:
                  - !Sub '${RawEventsBucket.Arn}/*'
                  - !Sub '${AnomalyEventsBucket.Arn}/*'
              - Effect: Allow
                Action:
                  - sns:Publish
                Resource: !Ref AnomalyNotificationTopic
```

## Outputs

Add this output to track the dedup table:

```yaml
Outputs:
  DedupTableName:
    Description: Name of the deduplication tracking table
    Value: !Ref DedupTable
    Export:
      Name: !Sub '${AWS::StackName}-DedupTable'
  
  DedupTableArn:
    Description: ARN of the deduplication tracking table
    Value: !GetAtt DedupTable.Arn
    Export:
      Name: !Sub '${AWS::StackName}-DedupTableArn'
```

## Deployment

Deploy with these changes:

```bash
sam build
sam deploy --guided
```

The CloudFormation stack will automatically:
1. Create the DynamoDB table with proper partitioning
2. Enable TTL on the `ttl` attribute for auto-cleanup
3. Update the Lambda environment variables
4. Configure IAM permissions for the function to access the table
5. Export table names for reference in other stacks

## Verification

After deployment, verify the stack:

```bash
aws cloudformation describe-stack-resources \
  --stack-name <your-stack-name> \
  --query 'StackResources[?LogicalResourceId==`DedupTable`]'
```

Check the Lambda environment variables:

```bash
aws lambda get-function-configuration \
  --function-name <StreamFunctionName> \
  --query 'Environment.Variables.DEDUP_TABLE'
```

Check TTL is enabled:

```bash
aws dynamodb describe-table \
  --table-name <your-stack-name>-event-dedup \
  --query 'Table.TimeToLiveDescription'
```

Should return something like:

```json
{
  "TimeToLiveStatus": "ENABLED",
  "AttributeName": "ttl"
}
```
